package com.agribridge.backend.service;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.text.Normalizer;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
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
    private volatile List<GhnProvince> provinceCache;
    private volatile List<GhnDistrict> districtCache;
    private final Map<Integer, List<GhnWard>> wardCacheByDistrictId = new ConcurrentHashMap<>();
    private final Map<String, GhnLocation> resolvedLocationCache = new ConcurrentHashMap<>();

    public GhnAddressMappingService(
            RestClient.Builder restClientBuilder,
            @Value("${ghn.api-base-url:${GHN_API_BASE_URL:https://dev-online-gateway.ghn.vn}}") String apiBaseUrl,
            @Value("${ghn.token:${GHN_TOKEN:}}") String token) {
        this.restClient = restClientBuilder.build();
        this.apiBaseUrl = stripTrailingSlash(apiBaseUrl);
        this.token = token;
    }

    public GhnLocation resolveForGhn(Address address, String role) {
        long start = System.currentTimeMillis();
        MappingResult mapping = toGhnCompatibleAddress(address);
        Address ghnAddress = mapping.address();
        log.info(
                "GHN address mapping: role={}, source={}, originalProvince={}, originalWard={}, originalAddress={}, ghnProvince={}, ghnWard={}",
                role,
                mapping.source(),
                address.province(),
                address.ward(),
                address.address(),
                ghnAddress.province(),
                ghnAddress.ward());
        try {
            GhnLocation location = resolveLocation(ghnAddress.province(), ghnAddress.ward(), role);
            log.info("Resolved GHN {} location in {}ms", role, System.currentTimeMillis() - start);
            return location;
        } catch (IllegalArgumentException ex) {
            log.warn("Failed to resolve GHN {} location in {}ms", role, System.currentTimeMillis() - start);
            throw unresolvedAddress(role, address, ex);
        }
    }

    private MappingResult toGhnCompatibleAddress(Address address) {
        String normalizedProvince = normalizeAdministrativeName(address.province());
        String normalizedWard = normalizeAdministrativeName(address.ward());
        String normalizedAddress = normalizeAdministrativeName(address.address());

        // Temporary compatibility aliases for GHN master data until GHN supports new administrative wards.
        if ("gia lai".equals(normalizedProvince) && "quy nhon".equals(normalizedWard)) {
            if (normalizedAddress.contains("tran phu")) {
                return temporaryAlias("Ph\u01b0\u1eddng Tr\u1ea7n Ph\u00fa", address);
            }
            if (normalizedAddress.contains("nguyen hue")) {
                return temporaryAlias("Ph\u01b0\u1eddng H\u1ea3i C\u1ea3ng", address);
            }
            if (normalizedAddress.contains("le loi")) {
                return temporaryAlias("Ph\u01b0\u1eddng L\u00ea L\u1ee3i", address);
            }
            if (normalizedAddress.contains("an duong vuong")) {
                return temporaryAlias("Ph\u01b0\u1eddng Nguy\u1ec5n V\u0103n C\u1eeb", address);
            }
            if (normalizedAddress.contains("xuan dieu")) {
                return temporaryAlias("Ph\u01b0\u1eddng H\u1ea3i C\u1ea3ng", address);
            }
        }

        return new MappingResult(address, "DIRECT_GHN_MASTER_DATA");
    }

    private MappingResult temporaryAlias(String ward, Address originalAddress) {
        return new MappingResult(
                new Address("B\u00ecnh \u0110\u1ecbnh", ward, originalAddress.address()),
                "TEMP_ALIAS_MAPPING");
    }

    private IllegalArgumentException unresolvedAddress(String role, Address address, Exception cause) {
        String normalizedRole = "sender".equals(role) ? "sender" : "receiver";
        String message = "Cannot resolve GHN-compatible " + normalizedRole + " address: province="
                + address.province()
                + ", ward="
                + address.ward()
                + ", address="
                + address.address()
                + ". This address is not mapped to GHN yet. Please choose a supported demo address or configure GHN address mapping.";
        return new IllegalArgumentException(message, cause);
    }

    private GhnLocation resolveLocation(String provinceName, String wardName, String role) {
        String normalizedProvince = normalizeAdministrativeName(provinceName);
        String normalizedWard = normalizeAdministrativeName(wardName);
        String cacheKey = normalizedProvince + "|" + normalizedWard;
        GhnLocation cached = resolvedLocationCache.get(cacheKey);
        if (cached != null) {
            log.info("Resolved GHN {} location from cache: province={}, ward={}", role, provinceName, wardName);
            return cached;
        }

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
            throw new IllegalArgumentException("Cannot resolve GHN-compatible address");
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
                GhnLocation location = new GhnLocation(district.districtId(), ward.wardCode());
                resolvedLocationCache.put(cacheKey, location);
                return location;
            }
        }

        log.warn(
                "Cannot resolve GHN {} ward in matched province: province={}, provinceId={}, ward={}, normalizedWard={}",
                role,
                provinceName,
                province.provinceId(),
                wardName,
                normalizedWard);
        throw new IllegalArgumentException("Cannot resolve GHN-compatible address");
    }

    private GhnProvince findProvince(String provinceName, String normalizedProvinceName) {
        List<GhnProvince> provinces = getProvinces();
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
        List<GhnDistrict> cached = districtCache;
        if (cached != null) {
            return cached;
        }

        synchronized (this) {
            if (districtCache != null) {
                return districtCache;
            }

            DistrictResponse response = restClient.get()
                    .uri(apiBaseUrl + DISTRICT_PATH)
                    .header("Token", token)
                    .retrieve()
                    .body(DistrictResponse.class);

            districtCache = response != null && response.data() != null ? response.data() : List.of();
            log.info("Loaded GHN district master data: count={}", districtCache.size());
            return districtCache;
        }
    }

    private List<GhnProvince> getProvinces() {
        List<GhnProvince> cached = provinceCache;
        if (cached != null) {
            return cached;
        }

        synchronized (this) {
            if (provinceCache != null) {
                return provinceCache;
            }

            ProvinceResponse response = restClient.get()
                    .uri(apiBaseUrl + PROVINCE_PATH)
                    .header("Token", token)
                    .retrieve()
                    .body(ProvinceResponse.class);

            provinceCache = response != null && response.data() != null ? response.data() : List.of();
            log.info("Loaded GHN province master data: count={}", provinceCache.size());
            return provinceCache;
        }
    }

    private GhnWard findWardInDistrict(Integer districtId, String wardName, String normalizedWardName) {
        if (districtId == null) {
            return null;
        }

        List<GhnWard> wards = getWards(districtId);
        return wards.stream()
                .filter(ward -> administrativeNamesMatch(normalizeAdministrativeName(ward.wardName()), normalizedWardName))
                .findFirst()
                .orElse(null);
    }

    private List<GhnWard> getWards(Integer districtId) {
        return wardCacheByDistrictId.computeIfAbsent(districtId, id -> {
            WardResponse response = restClient.get()
                    .uri(apiBaseUrl + WARD_PATH + "?district_id=" + id)
                    .header("Token", token)
                    .retrieve()
                    .body(WardResponse.class);

            List<GhnWard> wards = response != null && response.data() != null ? response.data() : List.of();
            log.info("Loaded GHN ward master data: districtId={}, count={}", id, wards.size());
            return wards;
        });
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

    private record MappingResult(Address address, String source) {
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
