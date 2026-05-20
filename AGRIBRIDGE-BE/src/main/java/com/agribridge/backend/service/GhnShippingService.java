package com.agribridge.backend.service;

import com.agribridge.backend.dto.shipping.ShippingQuoteRequest;
import com.agribridge.backend.dto.shipping.ShippingQuoteResponse;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.agribridge.backend.entity.BatchEntity;
import com.agribridge.backend.entity.CompanyEntity;
import com.agribridge.backend.entity.ProductEntity;
import com.agribridge.backend.entity.OrderEntity;
import com.agribridge.backend.entity.OrderItemEntity;
import com.agribridge.backend.entity.ShipmentEntity;
import com.agribridge.backend.entity.enums.ShipmentStatusEnum;
import com.agribridge.backend.repository.BatchRepository;
import com.agribridge.backend.repository.CompanyRepository;
import com.agribridge.backend.repository.OrderItemRepository;
import com.agribridge.backend.repository.ProductRepository;
import com.agribridge.backend.service.GhnAddressMappingService.Address;
import com.agribridge.backend.service.GhnAddressMappingService.GhnLocation;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.LinkedHashMap;
import java.util.List;
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

    private static final String CREATE_PATH = "/shiip/public-api/v2/shipping-order/create";
    private static final String DETAIL_PATH = "/shiip/public-api/v2/shipping-order/detail";

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
    private final OrderItemRepository orderItemRepository;
    private final String apiBaseUrl;
    private final String token;
    private final String shopId;
    private final ObjectMapper objectMapper = new ObjectMapper();

    public GhnShippingService(
            RestClient.Builder restClientBuilder,
            GhnAddressMappingService ghnAddressMappingService,
            BatchRepository batchRepository,
            CompanyRepository companyRepository,
            ProductRepository productRepository,
            OrderItemRepository orderItemRepository,
            @Value("${ghn.api-base-url:${GHN_API_BASE_URL:https://dev-online-gateway.ghn.vn}}") String apiBaseUrl,
            @Value("${ghn.token:${GHN_TOKEN:}}") String token,
            @Value("${ghn.shop-id:${GHN_SHOP_ID:}}") String shopId) {
        this.restClient = restClientBuilder.build();
        this.ghnAddressMappingService = ghnAddressMappingService;
        this.batchRepository = batchRepository;
        this.companyRepository = companyRepository;
        this.productRepository = productRepository;
        this.orderItemRepository = orderItemRepository;
        this.apiBaseUrl = stripTrailingSlash(apiBaseUrl);
        this.token = token;
        this.shopId = shopId;
    }

    // ── Public entry point ──────────────────────────────────────────────────────

    public ShippingQuoteResponse quote(ShippingQuoteRequest request) {
        log.info(
                "Shipping quote request: supplierId={}, batchId={}, toProvince={}, toDistrict={}, toWard={}",
                request.supplierId(),
                request.batchId(),
                request.toProvince(),
                request.toDistrict(),
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
     * Calls GHN API. Returns null if any resolution or API step fails (caller will
     * fallback).
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
                    new Address(sender.province(), sender.district(), sender.ward(), sender.address()));
        } catch (IllegalArgumentException senderEx) {
            log.warn("GHN sender location resolve failed: {}", senderEx.getMessage());
            return null;
        }

        // ── Resolve receiver GHN location ──
        GhnLocation to;
        try {
            to = ghnAddressMappingService.resolveForGhn(
                    new Address(request.toProvince(), request.toDistrict(), request.toWard(), request.toAddress()),
                    "receiver");
        } catch (IllegalArgumentException receiverEx) {
            log.warn("GHN receiver location resolve failed: {}", receiverEx.getMessage());
            return null;
        }

        // ── Call GHN fee API ──
        int quoteWeight = positiveOrDefault(request.weight(), 1000);
        int quoteLength = positiveOrDefault(request.length(), 40);
        int quoteWidth = positiveOrDefault(request.width(), 30);
        int quoteHeight = positiveOrDefault(request.height(), 30);
        int serviceTypeId = 2;
        BigDecimal insuranceValue = moneyOrZero(request.insuranceValue());

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("service_type_id", serviceTypeId);
        body.put("from_district_id", from.districtId());
        body.put("from_ward_code", from.wardCode());
        body.put("to_district_id", to.districtId());
        body.put("to_ward_code", to.wardCode());
        body.put("height", quoteHeight);
        body.put("length", quoteLength);
        body.put("weight", quoteWeight);
        body.put("width", quoteWidth);
        body.put("insurance_value", insuranceValue);
        body.put("coupon", null);
        logGhnFeeRequest(sender, from, request, to, body);

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

            logGhnFeeResponse(sender, total);
            return new ShippingQuoteResponse(
                    "GHN",
                    "Giao H\u00e0ng Nhanh",
                    STANDARD_SERVICE,
                    total,
                    "Theo GHN",
                    null,
                    null,
                    "BUYER",
                    true,
                    shopId,
                    from.districtId(),
                    from.wardCode(),
                    to.districtId(),
                    to.wardCode(),
                    quoteWeight,
                    quoteLength,
                    quoteWidth,
                    quoteHeight,
                    serviceTypeId,
                    null,
                    insuranceValue,
                    toJsonSafe(body),
                    toJsonSafe(response));
        } catch (RestClientResponseException ex) {
            log.warn("GHN API error: status={}, body={}", ex.getStatusCode(), ex.getResponseBodyAsString());
            return null;
        } catch (RestClientException ex) {
            log.warn("GHN API request failed: {}", ex.getMessage());
            return null;
        }
    }

    public GhnCreateOrderResponse createGhnShippingOrder(OrderEntity order, ShipmentEntity shipment) {
        if (!isGhnConfigured()) {
            throw new IllegalStateException("GHN is not configured");
        }
        CompanyEntity supplier = companyRepository.findById(order.getSupplierCompanyId())
                .orElseThrow(() -> new IllegalArgumentException("Supplier not found"));
        List<OrderItemEntity> orderItems = orderItemRepository.findByOrderIdOrderByIdAsc(order.getId());
        BigDecimal orderSubtotal = resolveOrderSubtotal(order, orderItems);
        BigDecimal shippingFee = moneyOrZero(order.getShippingFee());
        BigDecimal totalAmount = resolveTotalAmount(orderSubtotal, shippingFee, order.getTotalAmount());
        BigDecimal codAmount = isBuyerPayingViaPlatform(order) ? BigDecimal.ZERO : totalAmount;
        int createWeight = positiveOrDefault(shipment.getWeight(), 1000);
        int createLength = positiveOrDefault(shipment.getLength(), 40);
        int createWidth = positiveOrDefault(shipment.getWidth(), 30);
        int createHeight = positiveOrDefault(shipment.getHeight(), 30);
        int serviceTypeId = positiveOrDefault(shipment.getServiceTypeId(), 2);
        int fromDistrictId = shipment.getFromDistrictId() != null ? shipment.getFromDistrictId() : -1;
        String fromWardCode = shipment.getFromWardCode();
        int toDistrictId = shipment.getToDistrictId() != null ? shipment.getToDistrictId() : -1;
        String toWardCode = shipment.getToWardCode();
        String createShopId = StringUtils.hasText(shipment.getShopIdUsed()) ? shipment.getShopIdUsed() : shopId;
        validateCreateOrderSnapshotConsistency(shipment, createWeight, fromDistrictId, fromWardCode, toDistrictId, toWardCode, createShopId);
        GhnLocation from = new GhnLocation(fromDistrictId, fromWardCode);
        GhnLocation to = new GhnLocation(toDistrictId, toWardCode);
        logCreateVsQuoteComparison(shipment, createWeight, fromDistrictId, fromWardCode, toDistrictId, toWardCode, createShopId);
        List<Map<String, Object>> ghnItems = new java.util.ArrayList<>();
        int itemCount = orderItems.size();
        int perItemWeight = itemCount > 0 ? Math.max(1, createWeight / itemCount) : createWeight;
        int weightRemainder = itemCount > 0 ? Math.max(0, createWeight - (perItemWeight * itemCount)) : 0;
        int itemIndex = 0;
        for (OrderItemEntity item : orderItems) {
            ProductEntity product = productRepository.findById(item.getProductId()).orElse(null);
            Map<String, Object> ghnItem = new LinkedHashMap<>();
            ghnItem.put("name", product != null ? product.getName() : "San pham " + item.getProductId());
            ghnItem.put("quantity", item.getQuantity() != null ? item.getQuantity().intValue() : 1);
            ghnItem.put("price", item.getPrice() != null ? item.getPrice().intValue() : 0);
            int itemWeight = perItemWeight + (itemIndex == itemCount - 1 ? weightRemainder : 0);
            ghnItem.put("weight", itemWeight);
            ghnItems.add(ghnItem);
            itemIndex++;
        }
        if (ghnItems.isEmpty()) {
            Map<String, Object> ghnItem = new LinkedHashMap<>();
            ghnItem.put("name", "Nong san");
            ghnItem.put("quantity", 1);
            ghnItem.put("price", orderSubtotal.intValue());
            ghnItem.put("weight", createWeight);
            ghnItems.add(ghnItem);
        }
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("payment_type_id", 1);
        body.put("note", "AGRIBRIDGE DEMO");
        body.put("required_note", "KHONGCHOXEMHANG");
        body.put("return_phone", supplier.getPhone());
        body.put("return_address", supplier.getAddress());
        body.put("from_name", supplier.getName());
        body.put("from_phone", supplier.getPhone());
        body.put("from_address", supplier.getAddress());
        body.put("from_ward_code", fromWardCode);
        body.put("from_district_id", fromDistrictId);
        body.put("client_order_code", "AGRI-" + order.getId() + "-" + System.currentTimeMillis());
        body.put("to_name", shipment.getReceiverName());
        body.put("to_phone", shipment.getReceiverPhone());
        body.put("to_address", shipment.getReceiverAddress());
        body.put("to_ward_code", toWardCode);
        body.put("to_district_id", toDistrictId);
        body.put("weight", createWeight);
        body.put("length", createLength);
        body.put("width", createWidth);
        body.put("height", createHeight);
        body.put("insurance_value", moneyOrZero(shipment.getInsuranceValue()).intValue());
        body.put("cod_amount", codAmount.intValue());
        body.put("service_type_id", serviceTypeId);
        if (shipment.getServiceId() != null && shipment.getServiceId() > 0) {
            body.put("service_id", shipment.getServiceId());
        }
        body.put("items", ghnItems);
        logGhnCreateOrderRequest(supplier, from, shipment, to, body, orderSubtotal, shippingFee, totalAmount);
        try {
            GhnCreateOrderResponse response = restClient.post()
                    .uri(apiBaseUrl + CREATE_PATH)
                    .header("Token", token)
                    .header("ShopId", createShopId)
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(body)
                    .retrieve()
                    .body(GhnCreateOrderResponse.class);
            logGhnCreateOrderResponse(response);
            return response;
        } catch (RestClientResponseException ex) {
            log.warn("GHN Create API error: status={}, body={}", ex.getStatusCode(), ex.getResponseBodyAsString());
            throw new RuntimeException("GHN API failed: " + ex.getResponseBodyAsString());
        } catch (RestClientException ex) {
            log.warn("GHN Create API request failed: {}", ex.getMessage());
            throw new RuntimeException("GHN request failed", ex);
        }
    }

    public GhnOrderDetailResponse syncGhnOrderStatus(String orderCode) {
        if (!isGhnConfigured()) {
            throw new IllegalStateException("GHN is not configured");
        }

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("order_code", orderCode);

        try {
            return restClient.post()
                    .uri(apiBaseUrl + DETAIL_PATH)
                    .header("Token", token)
                    .header("ShopId", shopId)
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(body)
                    .retrieve()
                    .body(GhnOrderDetailResponse.class);
        } catch (RestClientResponseException ex) {
            log.warn("GHN Detail API error: status={}, body={}", ex.getStatusCode(), ex.getResponseBodyAsString());
            return null;
        } catch (RestClientException ex) {
            log.warn("GHN Detail API request failed: {}", ex.getMessage());
            return null;
        }
    }

    /**
     * Backward-compatible overload. Current implementation uses configured shop id,
     * so the shopId parameter is intentionally ignored.
     */
    public GhnOrderDetailResponse syncGhnOrderStatus(String orderCode, String shopId) {
        return syncGhnOrderStatus(orderCode);
    }

    /**
     * Backward-compatible no-op for previous GHN shop sync flow.
     */
    public CompanyEntity ensureSupplierGhnShop(CompanyEntity company) {
        if (company == null) {
            throw new IllegalArgumentException("Company is required");
        }
        return company;
    }

    public ShipmentStatusEnum mapGhnStatusToShipmentStatus(String ghnStatus) {
        if (ghnStatus == null)
            return ShipmentStatusEnum.PENDING;
        return switch (ghnStatus.toLowerCase()) {
            case "ready_to_pick", "picking" -> ShipmentStatusEnum.WAITING_PICKUP;
            case "picked" -> ShipmentStatusEnum.PICKED_UP;
            case "storing", "sorting", "transporting", "delivering" -> ShipmentStatusEnum.IN_TRANSIT;
            case "delivery" -> ShipmentStatusEnum.OUT_FOR_DELIVERY;
            case "delivered" -> ShipmentStatusEnum.WAITING_CONFIRMATION;
            case "delivery_fail" -> ShipmentStatusEnum.FAILED_DELIVERY;
            case "cancel" -> ShipmentStatusEnum.CANCELLED;
            case "lost", "damage" -> ShipmentStatusEnum.INCIDENT;
            default -> ShipmentStatusEnum.IN_TRANSIT;
        };
    }

    // ── Internal shipping fee calculation ───────────────────────────────────────

    /**
     * Calculates shipping fee using an internal formula when GHN is unavailable.
     * <p>
     * Formula:
     * 
     * <pre>
     *   weightKg    = ceil(weightGram / 1000)
     *   weightFee   = weightKg * 5_000
     *   distanceFee = sameProvince ? 15_000 : 50_000
     *   insuranceFee= min(insuranceValue * 0.005, 100_000)
     *   totalFee    = 30_000 (base) + weightFee + distanceFee + insuranceFee
     * </pre>
     * 
     * Example: 30 kg, different province, order 1,200,000đ
     * = 30,000 + 150,000 + 50,000 + 6,000 = 236,000đ
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
                insuranceValue.multiply(BigDecimal.valueOf(INSURANCE_RATE)).setScale(0, RoundingMode.HALF_UP)
                        .longValue(),
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
                true,
                null,
                null,
                null,
                null,
                null,
                weightGram,
                positiveOrDefault(request.length(), 40),
                positiveOrDefault(request.width(), 30),
                positiveOrDefault(request.height(), 30),
                null,
                null,
                insuranceValue,
                null,
                null);
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
        if (name == null)
            return "";
        return name.toLowerCase()
                .replaceAll("^(tỉnh|thành phố|tp\\.|tp )\\s*", "")
                .trim();
    }

    // ── Sender address resolution ───────────────────────────────────────────────

    /**
     * Resolves sender address without throwing. Returns null if not resolvable.
     * Internal fee calculation still works with null sender (treats as different
     * province).
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
                if (isAddressComplete(address))
                    return address;
            }
        }

        throw new IllegalArgumentException("Supplier address is missing or incomplete.");
    }

    private ShippingAddress resolveSenderAddressFromBatch(Long batchId) {
        BatchEntity batch = batchRepository.findById(batchId).orElse(null);
        if (batch == null || batch.getProductId() == null)
            return null;

        ProductEntity product = productRepository.findById(batch.getProductId()).orElse(null);
        if (product == null || product.getSupplierCompanyId() == null)
            return null;

        CompanyEntity supplierCompany = companyRepository.findById(product.getSupplierCompanyId()).orElse(null);
        if (supplierCompany == null)
            return null;

        return addressFromCompany("BATCH", supplierCompany);
    }

    private ShippingAddress addressFromCompany(String source, CompanyEntity company) {
        return new ShippingAddress(
                source,
                company.getName(),
                company.getProvince(),
                company.getDistrict(),
                company.getWard(),
                company.getAddress());
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

    private void validateCreateOrderSnapshotConsistency(
            ShipmentEntity shipment,
            int createWeight,
            int fromDistrictId,
            String fromWardCode,
            int toDistrictId,
            String toWardCode,
            String createShopId) {
        if (shipment.getWeight() == null
                || shipment.getFromDistrictId() == null
                || !StringUtils.hasText(shipment.getFromWardCode())
                || shipment.getToDistrictId() == null
                || !StringUtils.hasText(shipment.getToWardCode())) {
            throw new IllegalStateException("Missing GHN quote snapshot fields in shipment. Cannot create GHN order.");
        }
        boolean mismatch = shipment.getWeight() != createWeight
                || shipment.getFromDistrictId() != fromDistrictId
                || !shipment.getFromWardCode().equals(fromWardCode)
                || shipment.getToDistrictId() != toDistrictId
                || !shipment.getToWardCode().equals(toWardCode);
        if (mismatch) {
            log.error(
                    "GHN create aborted due to snapshot mismatch: quoteWeight={}, createWeight={}, quoteShopIdUsed={}, createShopIdUsed={}, quoteFromDistrictId={}, createFromDistrictId={}, quoteFromWardCode={}, createFromWardCode={}, quoteToDistrictId={}, createToDistrictId={}, quoteToWardCode={}, createToWardCode={}, quoteShippingFee={}",
                    shipment.getWeight(),
                    createWeight,
                    shipment.getShopIdUsed(),
                    createShopId,
                    shipment.getFromDistrictId(),
                    fromDistrictId,
                    shipment.getFromWardCode(),
                    fromWardCode,
                    shipment.getToDistrictId(),
                    toDistrictId,
                    shipment.getToWardCode(),
                    toWardCode,
                    shipment.getQuotedShippingFee());
            throw new IllegalStateException("GHN create payload mismatches quote snapshot. Creation blocked.");
        }
    }

    private void logCreateVsQuoteComparison(
            ShipmentEntity shipment,
            int createWeight,
            int fromDistrictId,
            String fromWardCode,
            int toDistrictId,
            String toWardCode,
            String createShopId) {
        log.info(
                "GHN quote vs create: quoteWeight={}, createWeight={}, quoteShopIdUsed={}, createShopIdUsed={}, quoteFromDistrictId={}, createFromDistrictId={}, quoteFromWardCode={}, createFromWardCode={}, quoteToDistrictId={}, createToDistrictId={}, quoteToWardCode={}, createToWardCode={}, quoteShippingFee={}",
                shipment.getWeight(),
                createWeight,
                shipment.getShopIdUsed(),
                createShopId,
                shipment.getFromDistrictId(),
                fromDistrictId,
                shipment.getFromWardCode(),
                fromWardCode,
                shipment.getToDistrictId(),
                toDistrictId,
                shipment.getToWardCode(),
                toWardCode,
                shipment.getQuotedShippingFee());
    }

    private String toJsonSafe(Object value) {
        if (value == null) {
            return null;
        }
        try {
            return objectMapper.writeValueAsString(value);
        } catch (JsonProcessingException ex) {
            return String.valueOf(value);
        }
    }

    private static BigDecimal moneyOrZero(BigDecimal value) {
        return value != null && value.compareTo(BigDecimal.ZERO) > 0 ? value : BigDecimal.ZERO;
    }

    private static String stripTrailingSlash(String value) {
        if (value == null)
            return "";
        return value.endsWith("/") ? value.substring(0, value.length() - 1) : value;
    }

    private void logGhnFeeRequest(
            ShippingAddress sender,
            GhnLocation from,
            ShippingQuoteRequest request,
            GhnLocation to,
            Map<String, Object> body) {
        log.info(
                "GHN fee request: supplierName={}, fromProvince={}, fromDistrict={}, fromWard={}, fromAddress={}, from_district_id={}, from_ward_code={}, toProvince={}, toDistrict={}, toWard={}, toAddress={}, to_district_id={}, to_ward_code={}, weight={}, insurance_value={}",
                sender != null ? sender.name() : "N/A",
                sender != null ? sender.province() : "N/A",
                sender != null ? sender.district() : "N/A",
                sender != null ? sender.ward() : "N/A",
                sender != null ? sender.address() : "N/A",
                from.districtId(),
                from.wardCode(),
                request.toProvince(),
                request.toDistrict(),
                request.toWard(),
                request.toAddress(),
                to.districtId(),
                to.wardCode(),
                body.get("weight"),
                body.get("insurance_value"));
    }

    private void logGhnFeeResponse(ShippingAddress sender, BigDecimal total) {
        log.info(
                "GHN fee response: supplierName={}, totalFee={}",
                sender != null ? sender.name() : "N/A",
                total);
    }

    private void logGhnCreateOrderRequest(
            CompanyEntity supplier,
            GhnLocation from,
            ShipmentEntity shipment,
            GhnLocation to,
            Map<String, Object> body,
            BigDecimal orderSubtotal,
            BigDecimal shippingFee,
            BigDecimal totalAmount) {
        log.info(
                "GHN create order request: subtotal={}, shippingFee={}, totalAmount={}, cod_amount={}, insurance_value={}, payment_type_id={}, items_price={}, from_name={}, from_phone={}, from_address={}, from_district_id={}, from_ward_code={}, to_name={}, to_phone={}, to_address={}, to_district_id={}, to_ward_code={}, weight={}",
                orderSubtotal,
                shippingFee,
                totalAmount,
                body.get("cod_amount"),
                body.get("insurance_value"),
                body.get("payment_type_id"),
                extractItemPrices(body.get("items")),
                supplier.getName(),
                supplier.getPhone(),
                supplier.getAddress(),
                from.districtId(),
                from.wardCode(),
                shipment.getReceiverName(),
                shipment.getReceiverPhone(),
                shipment.getReceiverAddress(),
                to.districtId(),
                to.wardCode(),
                body.get("weight"));
    }

    private static BigDecimal resolveOrderSubtotal(OrderEntity order, List<OrderItemEntity> orderItems) {
        BigDecimal subtotal = moneyOrZero(order.getSubtotal());
        if (subtotal.compareTo(BigDecimal.ZERO) > 0) {
            return subtotal;
        }
        BigDecimal sum = BigDecimal.ZERO;
        for (OrderItemEntity item : orderItems) {
            if (item.getSubtotal() != null && item.getSubtotal().compareTo(BigDecimal.ZERO) > 0) {
                sum = sum.add(item.getSubtotal());
                continue;
            }
            BigDecimal unitPrice = moneyOrZero(item.getPrice());
            BigDecimal quantity = item.getQuantity() != null ? item.getQuantity() : BigDecimal.ZERO;
            sum = sum.add(unitPrice.multiply(quantity));
        }
        return sum;
    }

    private static BigDecimal resolveTotalAmount(
            BigDecimal orderSubtotal,
            BigDecimal shippingFee,
            BigDecimal totalAmount) {
        BigDecimal resolved = moneyOrZero(totalAmount);
        if (resolved.compareTo(BigDecimal.ZERO) > 0) {
            return resolved;
        }
        return moneyOrZero(orderSubtotal).add(moneyOrZero(shippingFee));
    }

    private static boolean isBuyerPayingViaPlatform(OrderEntity order) {
        String paymentOption = order.getPaymentOption();
        String paymentMethod = order.getPaymentMethod();
        return equalsIgnoreCase(paymentOption, "ESCROW_TRANSFER")
                || equalsIgnoreCase(paymentOption, "FULL_PAYMENT")
                || equalsIgnoreCase(paymentMethod, "BANK_TRANSFER_DEMO");
    }

    private static boolean equalsIgnoreCase(String left, String right) {
        if (left == null || right == null) {
            return false;
        }
        return left.trim().equalsIgnoreCase(right.trim());
    }

    private static String extractItemPrices(Object itemsValue) {
        if (!(itemsValue instanceof List<?> items)) {
            return "[]";
        }
        StringBuilder builder = new StringBuilder("[");
        boolean first = true;
        for (Object item : items) {
            if (item instanceof Map<?, ?> map) {
                Object price = map.get("price");
                if (!first) {
                    builder.append(", ");
                }
                builder.append(price);
                first = false;
            }
        }
        builder.append(']');
        return builder.toString();
    }

    private void logGhnCreateOrderResponse(GhnCreateOrderResponse response) {
        if (response == null || response.data() == null) {
            log.warn("GHN create order response is empty");
            return;
        }
        log.info(
                "GHN create order response: code={}, message={}, order_code={}, total_fee={}, expected_delivery_time={}",
                response.code(),
                response.message(),
                response.data().order_code(),
                response.data().total_fee(),
                response.data().expected_delivery_time());
    }

    private record ShippingAddress(String source, String name, String province, String district, String ward,
            String address) {
    }

    private record GhnFeeResponse(GhnFeeData data) {
    }

    private record GhnFeeData(BigDecimal total) {
    }

    public record GhnCreateOrderResponse(Integer code, String message, GhnCreateOrderData data) {
    }

    public record GhnCreateOrderData(String order_code, String sort_code, String trans_type,
            String expected_delivery_time, BigDecimal total_fee) {
    }

    public record GhnOrderDetailResponse(Integer code, String message, GhnOrderDetailData data) {
    }

    public record GhnOrderDetailData(String order_code, String status) {
    }
}
