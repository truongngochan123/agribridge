package com.agribridge.backend.service;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.text.Normalizer;
import java.util.List;
import java.util.Locale;
import java.util.regex.Pattern;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.client.RestClient;

@Service
@Slf4j
public class GhnAddressMappingService {

    private static final String PROVINCE_PATH = "/shiip/public-api/master-data/province";
    private static final String DISTRICT_PATH = "/shiip/public-api/master-data/district";
    private static final String WARD_PATH = "/shiip/public-api/master-data/ward";
    private static final Pattern DIACRITICS = Pattern.compile("\\p{M}+");

    private final RestClient restClient;
    private final String apiBaseUrl;
    private final String token;

    public GhnAddressMappingService(
            RestClient.Builder restClientBuilder,
            @Value("${ghn.api-base-url:${GHN_API_BASE_URL:https://dev-online-gateway.ghn.vn}}") String apiBaseUrl,
            @Value("${ghn.token:${GHN_TOKEN:}}") String token) {
        this.restClient = restClientBuilder.build();
        this.apiBaseUrl = stripTrailingSlash(apiBaseUrl);
        this.token = token;
    }

    public GhnLocation resolveForGhn(Address address, String role) {
        Address ghnAddress = toGhnCompatibleAddress(address);
        log.info(
                "GHN address mapping: role={}, originalProvince={}, originalWard={}, originalAddress={}, ghnProvince={}, ghnWard={}",
                role,
                address.province(),
                address.ward(),
                address.address(),
                ghnAddress.province(),
                ghnAddress.ward());
        return resolveLocation(ghnAddress.province(), ghnAddress.ward(), role);
    }

    private Address toGhnCompatibleAddress(Address address) {
        String normalizedProvince = normalizeAdministrativeName(address.province());
        String normalizedWard = normalizeAdministrativeName(address.ward());
        String normalizedAddress = normalizeAdministrativeName(address.address());

        // Temporary compatibility aliases for GHN master data until GHN supports new administrative wards.
        if ("gia lai".equals(normalizedProvince) && "quy nhon".equals(normalizedWard)) {
            if (normalizedAddress.contains("tran phu")) {
                return new Address("B\u00ecnh \u0110\u1ecbnh", "Ph\u01b0\u1eddng Tr\u1ea7n Ph\u00fa", address.address());
            }
            if (normalizedAddress.contains("nguyen hue")) {
                return new Address("B\u00ecnh \u0110\u1ecbnh", "Ph\u01b0\u1eddng H\u1ea3i C\u1ea3ng", address.address());
            }
        }

        return address;
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
                    "Cannot resolve GHN-compatible address. Please configure GHN address mapping.");
        }

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
        throw new IllegalArgumentException("Cannot resolve GHN-compatible address. Please configure GHN address mapping.");
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
        return wards.stream()
                .filter(ward -> administrativeNamesMatch(normalizeAdministrativeName(ward.wardName()), normalizedWardName))
                .findFirst()
                .orElse(null);
    }

    static String normalizeAdministrativeName(String value) {
        if (!StringUtils.hasText(value)) {
            return "";
        }

        String normalized = value.replace('\u0110', 'D').replace('\u0111', 'd');
        normalized = Normalizer.normalize(normalized, Normalizer.Form.NFD);
        normalized = DIACRITICS.matcher(normalized).replaceAll("");
        normalized = normalized.toLowerCase(Locale.ROOT)
                .replaceAll("\\b(tinh|thanh pho|tp|quan|huyen|thi xa|thi tran|phuong|xa)\\b", "")
                .replaceAll("[^a-z0-9]+", " ")
                .trim();
        return normalized.replaceAll("\\s+", " ");
    }

    private static boolean administrativeNamesMatch(String normalizedA, String normalizedB) {
        if (!StringUtils.hasText(normalizedA) || !StringUtils.hasText(normalizedB)) {
            return false;
        }
        return normalizedA.equals(normalizedB)
                || normalizedA.contains(normalizedB)
                || normalizedB.contains(normalizedA);
    }

    private static String stripTrailingSlash(String value) {
        if (value == null) {
            return "";
        }
        return value.endsWith("/") ? value.substring(0, value.length() - 1) : value;
    }

    public record Address(String province, String ward, String address) {
    }

    public record GhnLocation(Integer districtId, String wardCode) {
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
}
