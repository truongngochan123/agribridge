package com.agribridge.backend.service.impl;

import com.agribridge.backend.service.SupplierMetadataService;
import java.text.Normalizer;
import java.util.List;
import java.util.Locale;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

@Service
@Slf4j
public class SupplierMetadataServiceImpl implements SupplierMetadataService {

    private static final List<String> UNITS = List.of(
            "kg", "g", "tấn", "lít", "ml", "thùng", "bao", "cái", "con", "trái", "bó", "cây", "hộp", "khay", "chai");

    private static final List<String> VIETNAM_PROVINCES = List.of(
            "Hà Nội", "Hồ Chí Minh", "Hải Phòng", "Đà Nẵng", "Cần Thơ",
            "An Giang", "Bà Rịa - Vũng Tàu", "Bạc Liêu", "Bắc Giang", "Bắc Kạn", "Bắc Ninh", "Bến Tre",
            "Bình Dương", "Bình Định", "Bình Phước", "Bình Thuận", "Cà Mau", "Cao Bằng", "Đắk Lắk",
            "Đắk Nông", "Điện Biên", "Đồng Nai", "Đồng Tháp", "Gia Lai", "Hà Giang", "Hà Nam", "Hà Tĩnh",
            "Hải Dương", "Hậu Giang", "Hòa Bình", "Hưng Yên", "Khánh Hòa", "Kiên Giang", "Kon Tum", "Lai Châu",
            "Lâm Đồng", "Lạng Sơn", "Lào Cai", "Long An", "Nam Định", "Nghệ An", "Ninh Bình", "Ninh Thuận",
            "Phú Thọ", "Phú Yên", "Quảng Bình", "Quảng Nam", "Quảng Ngãi", "Quảng Ninh", "Quảng Trị",
            "Sóc Trăng", "Sơn La", "Tây Ninh", "Thái Bình", "Thái Nguyên", "Thanh Hóa", "Thừa Thiên Huế",
            "Tiền Giang", "Trà Vinh", "Tuyên Quang", "Vĩnh Long", "Vĩnh Phúc", "Yên Bái");

    private static final List<String> DEFAULT_CERTIFICATION_NAMES = List.of(
            "VietGAP", "GlobalGAP", "HACCP", "ISO 22000", "Organic", "ASC", "BAP");

    @Override
    public List<String> getAllowedUnits() {
        log.debug("Fetching allowed supplier units");
        return UNITS;
    }

    @Override
    public List<String> getVietnamProvinces() {
        log.debug("Fetching Vietnam provinces metadata");
        return VIETNAM_PROVINCES;
    }

    @Override
    public List<String> getDefaultCertificationNames() {
        log.debug("Fetching default certification names");
        return DEFAULT_CERTIFICATION_NAMES;
    }

    @Override
    public boolean isAllowedUnit(String unit) {
        if (unit == null || unit.isBlank()) {
            log.debug("Unit validation failed because unit is blank");
            return false;
        }
        boolean allowed = UNITS.stream().anyMatch(allowedUnit -> allowedUnit.equalsIgnoreCase(unit.trim()));
        log.debug("Validated unit={} allowed={}", unit, allowed);
        return allowed;
    }

    @Override
    public boolean isValidProvince(String province) {
        if (province == null || province.isBlank()) {
            log.debug("Province validation failed because province is blank");
            return false;
        }

        String normalizedInput = normalize(province);
        boolean valid = VIETNAM_PROVINCES.stream().map(this::normalize).anyMatch(normalizedInput::equals);
        log.debug("Validated province={} valid={}", province, valid);
        return valid;
    }

    private String normalize(String text) {
        String normalized = Normalizer.normalize(text, Normalizer.Form.NFD)
                .replaceAll("\\p{M}", "")
                .toLowerCase(Locale.ROOT)
                .replace("đ", "d")
                .trim();
        return normalized.replaceAll("\\s+", " ");
    }
}
