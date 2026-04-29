package com.agribridge.backend.service;

import com.agribridge.backend.dto.shipping.ShippingQuoteRequest;
import com.agribridge.backend.dto.shipping.ShippingQuoteResponse;
import com.fasterxml.jackson.annotation.JsonProperty;
import java.math.BigDecimal;
import java.text.Normalizer;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.regex.Pattern;
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
    private static final String PROVINCE_PATH = "/shiip/public-api/master-data/province";
    private static final String DISTRICT_PATH = "/shiip/public-api/master-data/district";
    private static final String WARD_PATH = "/shiip/public-api/master-data/ward";
    private static final String FEE_PATH = "/shiip/public-api/v2/shipping-order/fee";
    private static final String STANDARD_SERVICE = "D\u1ecbch v\u1ee5 ti\u00eau chu\u1ea9n";
    private static final Pattern DIACRITICS = Pattern.compile("\\p{M}+");

    private final RestClient restClient;
    private final String apiBaseUrl;
    private final String token;
    private final String shopId;
    private final String defaultFromProvince;
    private final String defaultFromWard;
    private final String defaultFromAddress;

    public GhnShippingService(
            RestClient.Builder restClientBuilder,
            @Value("${ghn.api-base-url:${GHN_API_BASE_URL:https://dev-online-gateway.ghn.vn}}") String apiBaseUrl,
            @Value("${ghn.token:${GHN_TOKEN:}}") String token,
            @Value("${ghn.shop-id:${GHN_SHOP_ID:}}") String shopId,
            @Value("${ghn.default-from-province:${GHN_DEFAULT_FROM_PROVINCE:}}") String defaultFromProvince,
            @Value("${ghn.default-from-ward:${GHN_DEFAULT_FROM_WARD:}}") String defaultFromWard,
            @Value("${ghn.default-from-address:${GHN_DEFAULT_FROM_ADDRESS:}}") String defaultFromAddress) {
        this.restClient = restClientBuilder.build();
        this.apiBaseUrl = stripTrailingSlash(apiBaseUrl);
        this.token = token;
        this.shopId = shopId;
        this.defaultFromProvince = defaultFromProvince;
        this.defaultFromWard = defaultFromWard;
        this.defaultFromAddress = defaultFromAddress;
    }

    public ShippingQuoteResponse quote(ShippingQuoteRequest request) {
        validateGhnConfig();

        String fromProvince = firstText(request.fromProvince(), defaultFromProvince);
        String fromWard = firstText(request.fromWard(), defaultFromWard);
        String fromAddress = firstText(request.fromAddress(), defaultFromAddress);

        log.info(
                "GHN quote request address: toProvince={}, toWard={}, toAddress={}, defaultFromProvince={}, defaultFromWard={}, defaultFromAddress={}",
                request.toProvince(),
                request.toWard(),
                request.toAddress(),
                defaultFromProvince,
                defaultFromWard,
                defaultFromAddress);

        if (!StringUtils.hasText(fromProvince)
                || !StringUtils.hasText(fromWard)
                || !StringUtils.hasText(fromAddress)
                || !StringUtils.hasText(request.toProvince())
                || !StringUtils.hasText(request.toWard())
                || !StringUtils.hasText(request.toAddress())) {
            throw new IllegalArgumentException("Missing GHN sender/receiver address");
        }

        try {
            GhnLocation from = resolveLocation(fromProvince, fromWard, "sender");
            GhnLocation to = resolveLocation(request.toProvince(), request.toWard(), "receiver");

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
                "GHN config check: apiBaseUrl={}, tokenConfigured={}, shopId={}, defaultFromProvinceConfigured={}, defaultFromWardConfigured={}, defaultFromAddressConfigured={}",
                apiBaseUrl,
                StringUtils.hasText(token),
                shopId,
                StringUtils.hasText(defaultFromProvince),
                StringUtils.hasText(defaultFromWard),
                StringUtils.hasText(defaultFromAddress));

        if (!SANDBOX_BASE_URL.equals(apiBaseUrl) || !StringUtils.hasText(token) || !StringUtils.hasText(shopId)) {
            throw new IllegalStateException("GHN token/shopId is not configured");
        }
    }

    private GhnLocation resolveLocation(String provinceName, String wardName, String role) {
        String normalizedProvince = normalizeAdministrativeName(provinceName);
        String normalizedWard = normalizeAdministrativeName(wardName);
        log.info(
                "Resolving GHN {} location: provinceInput={}, normalizedProvince={}, wardInput={}, normalizedWard={}",
                role,
                provinceName,
                normalizedProvince,
                wardName,
                normalizedWard);

        GhnProvince province = findProvince(provinceName, normalizedProvince);
        if (province == null) {
            log.warn(
                    "Cannot resolve GHN {} province: province={}, normalizedProvince={}",
                    role,
                    provinceName,
                    normalizedProvince);
            throw new IllegalArgumentException(
                    "Cannot resolve GHN " + role + " location: province=" + provinceName + ", ward=" + wardName);
        }

        log.info(
                "Matched GHN {} province: provinceId={}, provinceName={}",
                role,
                province.provinceId(),
                province.provinceName());

        List<GhnDistrict> districts = getDistricts().stream()
                .filter(district -> district.provinceId() != null && district.provinceId().equals(province.provinceId()))
                .toList();
        log.info(
                "GHN {} province district count: provinceId={}, districtCount={}",
                role,
                province.provinceId(),
                districts.size());

        for (GhnDistrict district : districts) {
            GhnWard ward = findWardInDistrict(district.districtId(), wardName, normalizedWard);
            if (ward != null) {
                log.info(
                        "Matched GHN {} ward: districtId={}, wardCode={}, wardName={}",
                        role,
                        district.districtId(),
                        ward.wardCode(),
                        ward.wardName());
                return new GhnLocation(district.districtId(), ward.wardCode());
            }
        }

        log.warn(
                "Cannot resolve GHN {} ward in matched province: province={}, provinceId={}, ward={}, normalizedWard={}",
                role,
                provinceName,
                province.provinceId(),
                wardName,
                normalizedWard);
        String message = "Cannot resolve GHN " + role + " location: province=" + provinceName + ", ward=" + wardName;
        if ("receiver".equals(role)) {
            message += ". GHN master data does not support this new ward yet.";
        }
        throw new IllegalArgumentException(message);
    }

    private GhnProvince findProvince(String provinceName, String normalizedProvinceName) {
        ProvinceResponse response = restClient.get()
                .uri(apiBaseUrl + PROVINCE_PATH)
                .header("Token", token)
                .retrieve()
                .body(ProvinceResponse.class);

        List<GhnProvince> provinces = response != null && response.data() != null ? response.data() : List.of();
        GhnProvince matched = provinces.stream()
                .filter(province -> administrativeNamesMatch(
                        normalizeAdministrativeName(province.provinceName()), normalizedProvinceName))
                .findFirst()
                .orElse(null);
        log.info(
                "GHN province lookup: input={}, normalized={}, totalProvinces={}, matched={}",
                provinceName,
                normalizedProvinceName,
                provinces.size(),
                matched != null ? matched.provinceName() : null);
        return matched;
    }

    private List<GhnDistrict> getDistricts() {
        DistrictResponse response = restClient.get()
                .uri(apiBaseUrl + DISTRICT_PATH)
                .header("Token", token)
                .retrieve()
                .body(DistrictResponse.class);

        return response != null && response.data() != null ? response.data() : List.of();
    }

    private GhnWard findWardInDistrict(Integer districtId, String wardName, String normalizedWardName) {
        if (districtId == null) {
            return null;
        }

        WardResponse response = restClient.get()
                .uri(apiBaseUrl + WARD_PATH + "?district_id=" + districtId)
                .header("Token", token)
                .retrieve()
                .body(WardResponse.class);

        List<GhnWard> wards = response != null && response.data() != null ? response.data() : List.of();
        GhnWard matched = wards.stream()
                .filter(ward -> administrativeNamesMatch(normalizeAdministrativeName(ward.wardName()), normalizedWardName))
                .findFirst()
                .orElse(null);
        if (matched != null) {
            log.info(
                    "GHN ward lookup matched: districtId={}, input={}, normalized={}, wardCode={}, wardName={}",
                    districtId,
                    wardName,
                    normalizedWardName,
                    matched.wardCode(),
                    matched.wardName());
        }
        return matched;
    }

    private static boolean administrativeNamesMatch(String normalizedA, String normalizedB) {
        if (!StringUtils.hasText(normalizedA) || !StringUtils.hasText(normalizedB)) {
            return false;
        }
        return normalizedA.equals(normalizedB)
                || normalizedA.contains(normalizedB)
                || normalizedB.contains(normalizedA);
    }

    private static String firstText(String value, String fallback) {
        return StringUtils.hasText(value) ? value : fallback;
    }

    private static String normalizeAdministrativeName(String value) {
        if (!StringUtils.hasText(value)) {
            return "";
        }

        String normalized = value.replace('Đ', 'D').replace('đ', 'd');
        normalized = Normalizer.normalize(normalized, Normalizer.Form.NFD);
        normalized = DIACRITICS.matcher(normalized).replaceAll("");
        normalized = normalized.toLowerCase(Locale.ROOT)
                .replaceAll("\\b(tinh|thanh pho|tp|quan|huyen|thi xa|thi tran|phuong|xa)\\b", "")
                .replaceAll("[^a-z0-9]+", " ")
                .trim();
        return normalized.replaceAll("\\s+", " ");
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

    private record GhnLocation(Integer districtId, String wardCode) {
    }

    private record ProvinceResponse(List<GhnProvince> data) {
    }

    private record DistrictResponse(List<GhnDistrict> data) {
    }

    private record WardResponse(List<GhnWard> data) {
    }

    private record GhnProvince(
            @JsonProperty("ProvinceID") Integer provinceId,
            @JsonProperty("ProvinceName") String provinceName) {
    }

    private record GhnDistrict(
            @JsonProperty("DistrictID") Integer districtId,
            @JsonProperty("ProvinceID") Integer provinceId) {
    }

    private record GhnWard(
            @JsonProperty("WardCode") String wardCode,
            @JsonProperty("WardName") String wardName) {
    }

    private record GhnFeeResponse(GhnFeeData data) {
    }

    private record GhnFeeData(BigDecimal total) {
    }
}
