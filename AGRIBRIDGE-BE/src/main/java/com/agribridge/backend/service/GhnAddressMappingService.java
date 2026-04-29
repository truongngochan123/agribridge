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
        log.info(
                "GHN address mapping: role={}, source=DIRECT_GHN_MASTER_DATA, originalProvince={}, originalWard={}",
                role,
                address.province(),
                address.ward());
        try {
            GhnLocation location = resolveLocation(address.province(), address.ward(), role);
            log.info("Resolved GHN {} location in {}ms", role, System.currentTimeMillis() - start);
            return location;
        } catch (IllegalArgumentException ex) {
            log.warn("Failed to resolve GHN {} location in {}ms", role, System.currentTimeMillis() - start);
            String message = "receiver".equalsIgnoreCase(role)
                    ? "Xã/phường không thuộc tỉnh/thành đã chọn. Vui lòng chọn lại địa chỉ."
                    : "Cannot resolve GHN-compatible sender address.";
            throw new IllegalArgumentException(
                    message + " province=" + address.province() + ", ward=" + address.ward(),
                    ex);
        }
    }

    /**
     * Resolve sender (supplier/warehouse) address for GHN.
     * Strategy:
     * 1. Try exact province + ward match.
     * 2. If ward not found, treat ward text as a DISTRICT name and pick the first ward of that district.
     *    (e.g. "Phường Quy Nhơn" → normalizes to "quy nhon" → matches district "Thành phố Quy Nhơn")
     * This prevents hard 400 errors for suppliers whose ward field contains a city/district name.
     */
    public GhnLocation resolveForGhnSender(Address address) {
        long start = System.currentTimeMillis();
        log.info("GHN sender address mapping: province={}, ward={}", address.province(), address.ward());
        try {
            GhnLocation location = resolveLocationWithDistrictFallback(address.province(), address.ward());
            log.info("Resolved GHN sender location in {}ms", System.currentTimeMillis() - start);
            return location;
        } catch (IllegalArgumentException ex) {
            log.warn("Failed to resolve GHN sender location in {}ms: {}", System.currentTimeMillis() - start, ex.getMessage());
            throw new IllegalArgumentException(
                    "Cannot resolve GHN-compatible sender address. province=" + address.province() + ", ward=" + address.ward(),
                    ex);
        }
    }

    public DebugLocationResponse debugLocation(String provinceName, String wardName) {
        String normalizedProvince = normalizeAdministrativeName(provinceName);
        String normalizedWard = normalizeAdministrativeName(wardName);
        GhnProvince province = findProvince(provinceName, normalizedProvince);
        List<String> nearProvinceMatches = nearProvinceMatches(normalizedProvince);

        String matchedWard = null;
        String matchedWardCode = null;
        Integer matchedDistrictId = null;
        List<String> nearWardMatches = List.of();

        if (province != null) {
            List<GhnDistrict> districts = getDistricts().stream()
                    .filter(district -> district.provinceId() != null && district.provinceId().equals(province.provinceId()))
                    .toList();
            nearWardMatches = nearWardMatches(districts, normalizedWard);

            for (GhnDistrict district : districts) {
                GhnWard ward = findWardInDistrict(district.districtId(), wardName, normalizedWard);
                if (ward != null) {
                    matchedWard = ward.wardName();
                    matchedWardCode = ward.wardCode();
                    matchedDistrictId = district.districtId();
                    break;
                }
            }
        }

        return new DebugLocationResponse(
                provinceName,
                wardName,
                normalizedProvince,
                normalizedWard,
                province != null ? province.provinceName() : null,
                province != null ? province.provinceId() : null,
                matchedWard,
                matchedWardCode,
                matchedDistrictId,
                nearProvinceMatches,
                nearWardMatches);
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
                    "GHN near province matches for {}: {}",
                    normalizedProvince,
                    nearProvinceMatches(normalizedProvince));
            log.warn(
                    "Cannot resolve GHN {} province: province={}, normalizedProvince={}",
                    role,
                    provinceName,
                    normalizedProvince);
            throw new IllegalArgumentException("Cannot resolve GHN location");
        }

        List<GhnDistrict> districts = getDistricts().stream()
                .filter(district -> district.provinceId() != null && district.provinceId().equals(province.provinceId()))
                .toList();
        log.info(
                "GHN {} province district count: provinceId={}, districtCount={}",
                role,
                province.provinceId(),
                districts.size());
        log.info("GHN near ward matches for {}: {}", normalizedWard, nearWardMatches(districts, normalizedWard));

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
        throw new IllegalArgumentException("Cannot resolve GHN location");
    }

    /**
     * Like resolveLocation but with district-name fallback for sender addresses.
     * If the ward text doesn't match any ward, tries matching it against district names
     * and picks the first ward of the matching district.
     */
    private GhnLocation resolveLocationWithDistrictFallback(String provinceName, String wardName) {
        String normalizedProvince = normalizeAdministrativeName(provinceName);
        String normalizedWard = normalizeAdministrativeName(wardName);
        String cacheKey = "sender|" + normalizedProvince + "|" + normalizedWard;
        GhnLocation cached = resolvedLocationCache.get(cacheKey);
        if (cached != null) {
            log.info("Resolved GHN sender location from cache: province={}, ward={}", provinceName, wardName);
            return cached;
        }

        GhnProvince province = findProvince(provinceName, normalizedProvince);
        if (province == null) {
            throw new IllegalArgumentException("Cannot resolve GHN sender province: " + provinceName);
        }

        List<GhnDistrict> districts = getDistricts().stream()
                .filter(d -> d.provinceId() != null && d.provinceId().equals(province.provinceId()))
                .toList();

        // ── Pass 1: exact ward match ──────────────────────────────────────────
        for (GhnDistrict district : districts) {
            GhnWard ward = findWardInDistrict(district.districtId(), wardName, normalizedWard);
            if (ward != null) {
                log.info("Sender ward matched (pass 1): districtId={}, wardCode={}, wardName={}",
                        district.districtId(), ward.wardCode(), ward.wardName());
                GhnLocation location = new GhnLocation(district.districtId(), ward.wardCode());
                resolvedLocationCache.put(cacheKey, location);
                return location;
            }
        }

        // ── Pass 2: treat ward text as district name, pick first ward ─────────
        log.info("Sender ward not found in pass 1 — trying district-name fallback for ward='{}'", wardName);
        for (GhnDistrict district : districts) {
            if (district.districtName() == null) continue;
            String normalizedDistrictName = normalizeAdministrativeName(district.districtName());
            if (administrativeNamesMatch(normalizedDistrictName, normalizedWard)) {
                List<GhnWard> wards = getWards(district.districtId());
                if (!wards.isEmpty()) {
                    GhnWard firstWard = wards.get(0);
                    log.info("Sender ward resolved via district-name fallback: districtName={}, districtId={}, fallbackWard={}",
                            district.districtName(), district.districtId(), firstWard.wardName());
                    GhnLocation location = new GhnLocation(district.districtId(), firstWard.wardCode());
                    resolvedLocationCache.put(cacheKey, location);
                    return location;
                }
            }
        }

        throw new IllegalArgumentException(
                "Cannot resolve GHN sender location even with district fallback. province=" + provinceName + ", ward=" + wardName);
    }

    private List<String> nearProvinceMatches(String normalizedProvinceName) {
        return getProvinces().stream()
                .filter(province -> administrativeNamesMatch(
                        normalizeAdministrativeName(province.provinceName()), normalizedProvinceName))
                .map(province -> province.provinceId() + ":" + province.provinceName())
                .toList();
    }

    private List<String> nearWardMatches(List<GhnDistrict> districts, String normalizedWardName) {
        return districts.stream()
                .flatMap(district -> getWards(district.districtId()).stream()
                        .filter(ward -> administrativeNamesMatch(
                                normalizeAdministrativeName(ward.wardName()), normalizedWardName)
                                || normalizeAdministrativeName(ward.wardName()).contains("quy nhon"))
                        .map(ward -> district.districtId() + ":" + ward.wardCode() + ":" + ward.wardName()))
                .limit(20)
                .toList();
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

    public record DebugLocationResponse(
            String inputProvince,
            String inputWard,
            String normalizedProvince,
            String normalizedWard,
            String matchedProvince,
            Integer matchedProvinceId,
            String matchedWard,
            String matchedWardCode,
            Integer matchedDistrictId,
            List<String> nearProvinceMatches,
            List<String> nearWardMatches) {
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
            @JsonProperty("ProvinceID") Integer provinceId,
            @JsonProperty("DistrictName") String districtName) {
    }

    private record GhnWard(
            @JsonProperty("WardCode") String wardCode,
            @JsonProperty("WardName") String wardName) {
    }
}
