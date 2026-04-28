package com.agribridge.backend.service;

import com.agribridge.backend.dto.shipping.ShippingQuoteRequest;
import com.agribridge.backend.dto.shipping.ShippingQuoteResponse;
import java.math.BigDecimal;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.client.RestClient;

@Service
public class GhnShippingService {

    private static final String SANDBOX_BASE_URL = "https://dev-online-gateway.ghn.vn";
    private static final String FEE_PATH = "/shiip/public-api/v2/shipping-order/fee";
    private static final String STANDARD_SERVICE = "Dịch vụ tiêu chuẩn";
    private static final Map<String, GhnLocation> GHN_LOCATION_MAPPING = Map.of(
            normalizeKey("Hà Nội", "Phường Cửa Nam"), new GhnLocation(1442, "20108"),
            normalizeKey("Bình Định", "Phường Hải Cảng"), new GhnLocation(1450, "21211")
    );

    private final RestClient restClient;
    private final String apiBaseUrl;
    private final String token;
    private final String shopId;
    private final boolean mockEnabled;

    public GhnShippingService(
            RestClient.Builder restClientBuilder,
            @Value("${ghn.api-base-url:${GHN_API_BASE_URL:https://dev-online-gateway.ghn.vn}}") String apiBaseUrl,
            @Value("${ghn.token:${GHN_TOKEN:}}") String token,
            @Value("${ghn.shop-id:${GHN_SHOP_ID:}}") String shopId,
            @Value("${ghn.enable-mock:${GHN_ENABLE_MOCK:true}}") boolean mockEnabled) {
        this.restClient = restClientBuilder.build();
        this.apiBaseUrl = stripTrailingSlash(apiBaseUrl);
        this.token = token;
        this.shopId = shopId;
        this.mockEnabled = mockEnabled;
    }

    public ShippingQuoteResponse quote(ShippingQuoteRequest request) {
        if (!canCallGhn()) {
            return mockQuote(request);
        }

        GhnLocation from = resolveLocation(request.fromProvince(), request.fromWard());
        GhnLocation to = resolveLocation(request.toProvince(), request.toWard());
        if (from == null || to == null) {
            return mockQuote(request);
        }

        try {
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

            GhnFeeResponse response = restClient.post()
                    .uri(apiBaseUrl + FEE_PATH)
                    .header("Token", token)
                    .header("ShopId", shopId)
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(body)
                    .retrieve()
                    .body(GhnFeeResponse.class);

            BigDecimal total = response != null && response.data() != null
                    ? response.data().total()
                    : null;
            if (total == null) {
                return mockQuote(request);
            }

            return new ShippingQuoteResponse(
                    "GHN",
                    "Giao Hàng Nhanh",
                    STANDARD_SERVICE,
                    total,
                    "1 - 2 ngày",
                    1,
                    2,
                    "BUYER",
                    true);
        } catch (RuntimeException ex) {
            if (mockEnabled) {
                return mockQuote(request);
            }
            throw ex;
        }
    }

    private boolean canCallGhn() {
        return SANDBOX_BASE_URL.equals(apiBaseUrl)
                && StringUtils.hasText(token)
                && StringUtils.hasText(shopId);
    }

    private static GhnLocation resolveLocation(String province, String ward) {
        if (!StringUtils.hasText(province) || !StringUtils.hasText(ward)) {
            return null;
        }
        return GHN_LOCATION_MAPPING.get(normalizeKey(province, ward));
    }

    private static String normalizeKey(String province, String ward) {
        return (province + "|" + ward).trim().toLowerCase(Locale.ROOT);
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

    private static ShippingQuoteResponse mockQuote(ShippingQuoteRequest request) {
        int weight = request.weight() != null ? request.weight() : 0;
        BigDecimal fee;
        if (weight <= 10_000) {
            fee = BigDecimal.valueOf(60_000);
        } else if (weight <= 30_000) {
            fee = BigDecimal.valueOf(120_000);
        } else {
            fee = BigDecimal.valueOf(180_000);
        }

        return new ShippingQuoteResponse(
                "GHN_DEMO",
                "GHN Demo",
                STANDARD_SERVICE,
                fee,
                "1 - 2 ngày",
                1,
                2,
                "BUYER",
                true);
    }

    private record GhnLocation(int districtId, String wardCode) {
    }

    private record GhnFeeResponse(GhnFeeData data) {
    }

    private record GhnFeeData(BigDecimal total) {
    }
}
