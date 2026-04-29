package com.agribridge.backend.service;

import com.agribridge.backend.dto.shipping.ShippingQuoteRequest;
import com.agribridge.backend.dto.shipping.ShippingQuoteResponse;
import com.agribridge.backend.entity.BatchEntity;
import com.agribridge.backend.entity.CompanyEntity;
import com.agribridge.backend.entity.ProductEntity;
import com.agribridge.backend.repository.BatchRepository;
import com.agribridge.backend.repository.CompanyRepository;
import com.agribridge.backend.repository.ProductRepository;
import com.agribridge.backend.service.GhnAddressMappingService.Address;
import com.agribridge.backend.service.GhnAddressMappingService.GhnLocation;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.LinkedHashMap;
import java.util.Map;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestClientResponseException;

@Service
@Slf4j
public class GhnShippingService {

    private static final String SANDBOX_BASE_URL = "https://dev-online-gateway.ghn.vn";
    private static final String FEE_PATH = "/shiip/public-api/v2/shipping-order/fee";
    private static final String STANDARD_SERVICE = "D\u1ecbch v\u1ee5 ti\u00eau chu\u1ea9n";

    // ── Internal fee constants ──────────────────────────────────────────────────
    /** Base handling fee (đồng). */
    private static final long BASE_FEE = 30_000L;
    /** Per-kg surcharge (đồng). */
    private static final long WEIGHT_FEE_PER_KG = 5_000L;
    /** Extra fee when sender and receiver are in the same province. */
    private static final long SAME_PROVINCE_FEE = 15_000L;
    /** Extra fee when sender and receiver are in different provinces. */
    private static final long DIFF_PROVINCE_FEE = 50_000L;
    /** Insurance fee rate (0.5% of declared value). */
    private static final double INSURANCE_RATE = 0.005;
    /** Maximum insurance fee cap (đồng). */
    private static final long MAX_INSURANCE_FEE = 100_000L;

    private final RestClient restClient;
    private final GhnAddressMappingService ghnAddressMappingService;
    private final BatchRepository batchRepository;
    private final CompanyRepository companyRepository;
    private final ProductRepository productRepository;
    private final String apiBaseUrl;
    private final String token;
    private final String shopId;

    public GhnShippingService(
            RestClient.Builder restClientBuilder,
            GhnAddressMappingService ghnAddressMappingService,
            BatchRepository batchRepository,
            CompanyRepository companyRepository,
            ProductRepository productRepository,
            @Value("${ghn.api-base-url:${GHN_API_BASE_URL:https://dev-online-gateway.ghn.vn}}") String apiBaseUrl,
            @Value("${ghn.token:${GHN_TOKEN:}}") String token,
            @Value("${ghn.shop-id:${GHN_SHOP_ID:}}") String shopId) {
        this.restClient = restClientBuilder.build();
        this.ghnAddressMappingService = ghnAddressMappingService;
        this.batchRepository = batchRepository;
        this.companyRepository = companyRepository;
        this.productRepository = productRepository;
        this.apiBaseUrl = stripTrailingSlash(apiBaseUrl);
        this.token = token;
        this.shopId = shopId;
    }

    // ── Public entry point ──────────────────────────────────────────────────────

    public ShippingQuoteResponse quote(ShippingQuoteRequest request) {
        log.info(
                "Shipping quote request: supplierId={}, batchId={}, toProvince={}, toWard={}",
                request.supplierId(),
                request.batchId(),
                request.toProvince(),
                request.toWard());

        if (!StringUtils.hasText(request.toProvince())
                || !StringUtils.hasText(request.toWard())
                || !StringUtils.hasText(request.toAddress())) {
            throw new IllegalArgumentException("Buyer delivery address is missing. Cannot calculate shipping fee.");
        }

        // ── 1. Resolve sender (supplier/warehouse) address ──────────────────────
        ShippingAddress sender = tryResolveSenderAddress(request);

        // ── 2. Try GHN first ────────────────────────────────────────────────────
        if (isGhnConfigured()) {
            try {
                ShippingQuoteResponse ghnResponse = callGhn(request, sender);
                if (ghnResponse != null) {
                    log.info("GHN quote success: fee={}", ghnResponse.estimatedShippingFee());
                    return ghnResponse;
                }
            } catch (Exception ghnEx) {
                log.warn(
                        "GHN quote failed — falling back to internal calculation. reason={}, senderProvince={}, receiverProvince={}",
                        ghnEx.getMessage(),
                        sender != null ? sender.province() : "N/A",
                        request.toProvince());
            }
        } else {
            log.info("GHN not configured — using internal shipping calculation directly.");
        }

        // ── 3. Fallback: internal fee calculation ───────────────────────────────
        return calculateInternalShippingQuote(request, sender);
    }

    // ── GHN integration ─────────────────────────────────────────────────────────

    private boolean isGhnConfigured() {
        return SANDBOX_BASE_URL.equals(apiBaseUrl)
                && StringUtils.hasText(token)
                && StringUtils.hasText(shopId);
    }

    /**
     * Calls GHN API. Returns null if any resolution or API step fails (caller will fallback).
     */
    private ShippingQuoteResponse callGhn(ShippingQuoteRequest request, ShippingAddress sender) {
        // ── Resolve sender GHN location ──
        if (sender == null) {
            log.warn("GHN: sender address is null, cannot call GHN.");
            return null;
        }
        GhnLocation from;
        try {
            from = ghnAddressMappingService.resolveForGhnSender(
                    new Address(sender.province(), sender.ward(), sender.address()));
        } catch (IllegalArgumentException senderEx) {
            log.warn("GHN sender location resolve failed: {}", senderEx.getMessage());
            return null;
        }

        // ── Resolve receiver GHN location ──
        GhnLocation to;
        try {
            to = ghnAddressMappingService.resolveForGhn(
                    new Address(request.toProvince(), request.toWard(), request.toAddress()), "receiver");
        } catch (IllegalArgumentException receiverEx) {
            log.warn("GHN receiver location resolve failed: {}", receiverEx.getMessage());
            return null;
        }

        // ── Call GHN fee API ──
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("service_type_id", 2);
        body.put("from_district_id", from.districtId());
        body.put("from_ward_code", from.wardCode());
        body.put("to_district_id", to.districtId());
        body.put("to_ward_code", to.wardCode());
        body.put("height", positiveOrDefault(request.height(), 30));
        body.put("length", positiveOrDefault(request.length(), 40));
        body.put("weight", positiveOrDefault(request.weight(), 1000));
        body.put("width", positiveOrDefault(request.width(), 30));
        body.put("insurance_value", moneyOrZero(request.insuranceValue()));
        body.put("coupon", null);

        log.info("Calling GHN fee API: from_district={}, to_district={}", from.districtId(), to.districtId());

        try {
            GhnFeeResponse response = restClient.post()
                    .uri(apiBaseUrl + FEE_PATH)
                    .header("Token", token)
                    .header("ShopId", shopId)
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(body)
                    .retrieve()
                    .body(GhnFeeResponse.class);

            BigDecimal total = response != null && response.data() != null ? response.data().total() : null;
            if (total == null) {
                log.warn("GHN fee API returned null total");
                return null;
            }

            return new ShippingQuoteResponse(
                    "GHN",
                    "Giao H\u00e0ng Nhanh",
                    STANDARD_SERVICE,
                    total,
                    "Theo GHN",
                    null,
                    null,
                    "BUYER",
                    true);
        } catch (RestClientResponseException ex) {
            log.warn("GHN API error: status={}, body={}", ex.getStatusCode(), ex.getResponseBodyAsString());
            return null;
        } catch (RestClientException ex) {
            log.warn("GHN API request failed: {}", ex.getMessage());
            return null;
        }
    }

    // ── Internal shipping fee calculation ───────────────────────────────────────

    /**
     * Calculates shipping fee using an internal formula when GHN is unavailable.
     * <p>
     * Formula:
     * <pre>
     *   weightKg    = ceil(weightGram / 1000)
     *   weightFee   = weightKg * 5_000
     *   distanceFee = sameProvince ? 15_000 : 50_000
     *   insuranceFee= min(insuranceValue * 0.005, 100_000)
     *   totalFee    = 30_000 (base) + weightFee + distanceFee + insuranceFee
     * </pre>
     * Example: 30 kg, different province, order 1,200,000đ
     *   = 30,000 + 150,000 + 50,000 + 6,000 = 236,000đ
     */
    ShippingQuoteResponse calculateInternalShippingQuote(ShippingQuoteRequest request, ShippingAddress sender) {
        int weightGram = positiveOrDefault(request.weight(), 1000);
        long weightKg = (long) Math.ceil(weightGram / 1000.0);
        long weightFee = weightKg * WEIGHT_FEE_PER_KG;

        boolean sameProvince = isSameProvince(
                sender != null ? sender.province() : null,
                request.toProvince());
        long distanceFee = sameProvince ? SAME_PROVINCE_FEE : DIFF_PROVINCE_FEE;

        BigDecimal insuranceValue = moneyOrZero(request.insuranceValue());
        long insuranceFee = Math.min(
                insuranceValue.multiply(BigDecimal.valueOf(INSURANCE_RATE)).setScale(0, RoundingMode.HALF_UP).longValue(),
                MAX_INSURANCE_FEE);

        long totalFee = BASE_FEE + weightFee + distanceFee + insuranceFee;
        BigDecimal fee = BigDecimal.valueOf(totalFee);

        String deliveryTime = sameProvince ? "1 - 2 ng\u00e0y" : "2 - 5 ng\u00e0y";
        int daysMin = sameProvince ? 1 : 2;
        int daysMax = sameProvince ? 2 : 5;

        log.info(
                "Internal shipping fee: base={}, weight={}g→{}kg×{}={}, distance={} (sameProvince={}), insurance={} → total={}",
                BASE_FEE, weightGram, weightKg, WEIGHT_FEE_PER_KG, weightFee,
                distanceFee, sameProvince, insuranceFee, totalFee);

        return new ShippingQuoteResponse(
                "INTERNAL",
                "V\u1eadn chuy\u1ec3n n\u1ed9i b\u1ed9",
                "T\u00ednh ph\u00ed t\u1ea1m t\u00ednh",
                fee,
                deliveryTime,
                daysMin,
                daysMax,
                "BUYER",
                true);
    }

    private static boolean isSameProvince(String senderProvince, String receiverProvince) {
        if (!StringUtils.hasText(senderProvince) || !StringUtils.hasText(receiverProvince)) {
            return false;
        }
        String a = normalizeProvinceName(senderProvince);
        String b = normalizeProvinceName(receiverProvince);
        return a.equals(b) || a.contains(b) || b.contains(a);
    }

    private static String normalizeProvinceName(String name) {
        if (name == null) return "";
        return name.toLowerCase()
                .replaceAll("^(tỉnh|thành phố|tp\\.|tp )\\s*", "")
                .trim();
    }

    // ── Sender address resolution ───────────────────────────────────────────────

    /**
     * Resolves sender address without throwing. Returns null if not resolvable.
     * Internal fee calculation still works with null sender (treats as different province).
     */
    private ShippingAddress tryResolveSenderAddress(ShippingQuoteRequest request) {
        try {
            return resolveSenderAddress(request);
        } catch (Exception ex) {
            log.warn("Could not resolve sender address: {}", ex.getMessage());
            return null;
        }
    }

    private ShippingAddress resolveSenderAddress(ShippingQuoteRequest request) {
        log.info("Resolving sender address: supplierId={}, batchId={}", request.supplierId(), request.batchId());

        if (request.batchId() != null) {
            ShippingAddress address = resolveSenderAddressFromBatch(request.batchId());
            if (address != null && isAddressComplete(address)) {
                return address;
            }
        }

        if (request.supplierId() != null) {
            CompanyEntity supplierCompany = companyRepository.findById(request.supplierId()).orElse(null);
            if (supplierCompany != null) {
                ShippingAddress address = addressFromCompany("SUPPLIER_COMPANY", supplierCompany);
                if (isAddressComplete(address)) return address;
            }
        }

        throw new IllegalArgumentException("Supplier address is missing or incomplete.");
    }

    private ShippingAddress resolveSenderAddressFromBatch(Long batchId) {
        BatchEntity batch = batchRepository.findById(batchId).orElse(null);
        if (batch == null || batch.getProductId() == null) return null;

        ProductEntity product = productRepository.findById(batch.getProductId()).orElse(null);
        if (product == null || product.getSupplierCompanyId() == null) return null;

        CompanyEntity supplierCompany = companyRepository.findById(product.getSupplierCompanyId()).orElse(null);
        if (supplierCompany == null) return null;

        return addressFromCompany("BATCH", supplierCompany);
    }

    private ShippingAddress addressFromCompany(String source, CompanyEntity company) {
        return new ShippingAddress(source, company.getProvince(), company.getWard(), company.getAddress());
    }

    private static boolean isAddressComplete(ShippingAddress address) {
        return address != null
                && StringUtils.hasText(address.province())
                && StringUtils.hasText(address.ward())
                && StringUtils.hasText(address.address());
    }

    // ── Helpers ─────────────────────────────────────────────────────────────────

    private static int positiveOrDefault(Integer value, int fallback) {
        return value != null && value > 0 ? value : fallback;
    }

    private static BigDecimal moneyOrZero(BigDecimal value) {
        return value != null && value.compareTo(BigDecimal.ZERO) > 0 ? value : BigDecimal.ZERO;
    }

    private static String stripTrailingSlash(String value) {
        if (value == null) return "";
        return value.endsWith("/") ? value.substring(0, value.length() - 1) : value;
    }

    private record ShippingAddress(String source, String province, String ward, String address) {}

    private record GhnFeeResponse(GhnFeeData data) {}

    private record GhnFeeData(BigDecimal total) {}
}
