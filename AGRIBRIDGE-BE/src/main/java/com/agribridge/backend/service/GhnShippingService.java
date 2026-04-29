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

    public ShippingQuoteResponse quote(ShippingQuoteRequest request) {
        validateGhnConfig();

        log.info(
                "GHN quote request: supplierId={}, batchId={}, toProvince={}, toWard={}, toAddress={}",
                request.supplierId(),
                request.batchId(),
                request.toProvince(),
                request.toWard(),
                request.toAddress());

        if (!StringUtils.hasText(request.toProvince())
                || !StringUtils.hasText(request.toWard())
                || !StringUtils.hasText(request.toAddress())) {
            throw new IllegalArgumentException("Buyer delivery address is missing. Cannot calculate GHN shipping fee.");
        }

        ShippingAddress sender = resolveSenderAddress(request);
        log.info(
                "GHN sender address resolved from real company data: senderSource={}, province={}, ward={}, address={}",
                sender.source(),
                sender.province(),
                sender.ward(),
                sender.address());

        try {
            long senderResolveStart = System.currentTimeMillis();
            GhnLocation from = ghnAddressMappingService.resolveForGhn(
                    new Address(sender.province(), sender.ward(), sender.address()), "sender");
            log.info("Resolved GHN sender location in {}ms", System.currentTimeMillis() - senderResolveStart);

            long receiverResolveStart = System.currentTimeMillis();
            GhnLocation to = ghnAddressMappingService.resolveForGhn(
                    new Address(request.toProvince(), request.toWard(), request.toAddress()), "receiver");
            log.info("Resolved GHN receiver location in {}ms", System.currentTimeMillis() - receiverResolveStart);

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

            log.info("Calling GHN shipping quote API {}", FEE_PATH);
            long feeStart = System.currentTimeMillis();
            GhnFeeResponse response = restClient.post()
                    .uri(apiBaseUrl + FEE_PATH)
                    .header("Token", token)
                    .header("ShopId", shopId)
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(body)
                    .retrieve()
                    .body(GhnFeeResponse.class);
            log.info("GHN shipping fee API responded in {}ms", System.currentTimeMillis() - feeStart);

            BigDecimal total = response != null && response.data() != null ? response.data().total() : null;
            if (total == null) {
                throw new IllegalStateException("GHN response data.total is null");
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
            log.warn("GHN API returned error: status={}, body={}", ex.getStatusCode(), ex.getResponseBodyAsString());
            throw new IllegalStateException("GHN shipping quote request failed: " + ex.getStatusCode(), ex);
        } catch (RestClientException ex) {
            log.warn("GHN API request failed: {}", ex.getMessage());
            throw new IllegalStateException("GHN shipping quote request failed", ex);
        }
    }

    private void validateGhnConfig() {
        log.info(
                "GHN config check: apiBaseUrl={}, tokenConfigured={}, shopId={}",
                apiBaseUrl,
                StringUtils.hasText(token),
                shopId);

        if (!SANDBOX_BASE_URL.equals(apiBaseUrl) || !StringUtils.hasText(token) || !StringUtils.hasText(shopId)) {
            throw new IllegalStateException("GHN token/shopId is not configured");
        }
    }

    private ShippingAddress resolveSenderAddress(ShippingQuoteRequest request) {
        log.info("Resolving GHN sender address: supplierId={}, batchId={}", request.supplierId(), request.batchId());

        if (request.batchId() != null) {
            ShippingAddress address = resolveSenderAddressFromBatch(request.batchId());
            if (address != null) {
                validateSupplierAddress(address);
                return address;
            }
        }

        if (request.supplierId() != null) {
            CompanyEntity supplierCompany = companyRepository.findById(request.supplierId()).orElse(null);
            if (supplierCompany != null) {
                ShippingAddress address = addressFromCompany("SUPPLIER_COMPANY", supplierCompany);
                validateSupplierAddress(address);
                return address;
            }
        }

        throw new IllegalArgumentException("Supplier address is missing. Cannot calculate GHN shipping fee.");
    }

    private ShippingAddress resolveSenderAddressFromBatch(Long batchId) {
        BatchEntity batch = batchRepository.findById(batchId).orElse(null);
        if (batch == null || batch.getProductId() == null) {
            return null;
        }

        ProductEntity product = productRepository.findById(batch.getProductId()).orElse(null);
        if (product == null || product.getSupplierCompanyId() == null) {
            return null;
        }

        CompanyEntity supplierCompany = companyRepository.findById(product.getSupplierCompanyId()).orElse(null);
        if (supplierCompany == null) {
            return null;
        }

        return addressFromCompany("BATCH", supplierCompany);
    }

    private ShippingAddress addressFromCompany(String source, CompanyEntity company) {
        return new ShippingAddress(source, company.getProvince(), company.getWard(), company.getAddress());
    }

    private void validateSupplierAddress(ShippingAddress address) {
        if (address == null
                || !StringUtils.hasText(address.province())
                || !StringUtils.hasText(address.ward())
                || !StringUtils.hasText(address.address())) {
            throw new IllegalArgumentException("Supplier address is missing. Cannot calculate GHN shipping fee.");
        }
    }

    private static int positiveOrDefault(Integer value, int fallback) {
        return value != null && value > 0 ? value : fallback;
    }

    private static BigDecimal moneyOrZero(BigDecimal value) {
        return value != null && value.compareTo(BigDecimal.ZERO) > 0 ? value : BigDecimal.ZERO;
    }

    private static String stripTrailingSlash(String value) {
        if (value == null) {
            return "";
        }
        return value.endsWith("/") ? value.substring(0, value.length() - 1) : value;
    }

    private record ShippingAddress(String source, String province, String ward, String address) {
    }

    private record GhnFeeResponse(GhnFeeData data) {
    }

    private record GhnFeeData(BigDecimal total) {
    }
}
