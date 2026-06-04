package com.agribridge.backend.controller;

import com.agribridge.backend.dto.CurrentUserProfileDto;
import com.agribridge.backend.entity.CompanyEntity;
import com.agribridge.backend.entity.UserEntity;
import com.agribridge.backend.entity.enums.CompanyTypeEnum;
import com.agribridge.backend.entity.enums.UserRoleEnum;
import com.agribridge.backend.repository.CompanyRepository;
import com.agribridge.backend.service.CurrentUserService;
import java.time.format.DateTimeFormatter;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/current-user")
@RequiredArgsConstructor
public class CurrentUserProfileController {

    private static final DateTimeFormatter DATE_FORMATTER = DateTimeFormatter.ofPattern("dd/MM/yyyy");

    private final CurrentUserService currentUserService;
    private final CompanyRepository companyRepository;

    @GetMapping("/profile")
    public CurrentUserProfileDto profile() {
        UserEntity user = currentUserService.requireCurrentUser();
        if (UserRoleEnum.ADMIN.equals(user.getRole())) {
            String fullName = firstText(user.getFullName(), "Quản trị viên");
            return new CurrentUserProfileDto(
                    user.getId(),
                    null,
                    fullName,
                    firstText(user.getEmail(), "admin@agribridge.vn"),
                    firstText(user.getPhone(), "N/A"),
                    "Quản trị viên",
                    "ADM-" + String.format("%06d", user.getId()),
                    "ADMIN",
                    "Quản trị viên / Admin",
                    user.getCreatedAt() == null ? "N/A" : user.getCreatedAt().format(DATE_FORMATTER),
                    "Đang hoạt động",
                    initials(fullName),
                    "AgriBridge",
                    "N/A",
                    "N/A",
                    "N/A",
                    "N/A",
                    "N/A",
                    "N/A",
                    null,
                    "N/A",
                    "N/A",
                    fullName,
                    "N/A");
        }
        CompanyEntity company = companyRepository.findById(user.getCompanyId())
                .orElseThrow(() -> new IllegalArgumentException("COMPANY_NOT_FOUND"));
        String companyType = company.getCompanyType() == null ? null : company.getCompanyType().name();
        String fullName = firstText(user.getFullName(), company.getOwnerName(), "Người dùng");
        String prefix = CompanyTypeEnum.BUYER.equals(company.getCompanyType()) ? "BUY" : "SUP";
        return new CurrentUserProfileDto(
                user.getId(),
                company.getId(),
                fullName,
                firstText(user.getEmail(), company.getEmail(), "N/A"),
                firstText(user.getPhone(), company.getPhone(), "N/A"),
                roleLabel(company.getCompanyType()),
                prefix + "-" + String.format("%06d", company.getId()),
                companyType,
                companyTypeLabel(company.getCompanyType()),
                user.getCreatedAt() == null ? "N/A" : user.getCreatedAt().format(DATE_FORMATTER),
                Boolean.TRUE.equals(company.getVerifiedStatus()) ? "Đã xác minh" : "Chờ xác minh",
                initials(fullName),
                firstText(company.getName(), "N/A"),
                firstText(company.getTaxCode(), "N/A"),
                firstText(company.getRegistrationNumber(), "N/A"),
                company.getEstablishedYear() == null ? "N/A" : String.valueOf(company.getEstablishedYear()),
                firstText(company.getWebsite(), "N/A"),
                firstText(company.getProvince(), "N/A"),
                firstText(company.getDistrict(), "N/A"),
                company.getWard(),
                firstText(company.getAddress(), "N/A"),
                firstText(company.getDescription(), "N/A"),
                firstText(company.getOwnerName(), fullName),
                company.getBusinessType() == null ? "N/A" : company.getBusinessType().name());
    }

    private String roleLabel(CompanyTypeEnum type) {
        if (CompanyTypeEnum.SUPPLIER.equals(type)) return "Nhà cung cấp";
        if (CompanyTypeEnum.BUYER.equals(type)) return "Nhà buôn";
        return "Người dùng";
    }

    private String companyTypeLabel(CompanyTypeEnum type) {
        if (CompanyTypeEnum.SUPPLIER.equals(type)) return "Nhà cung cấp / Supplier";
        if (CompanyTypeEnum.BUYER.equals(type)) return "Nhà buôn / Buyer";
        return "N/A";
    }

    private String firstText(String... values) {
        for (String value : values) {
            if (value != null && !value.isBlank()) return value.trim();
        }
        return "N/A";
    }

    private String initials(String value) {
        String[] parts = firstText(value).trim().split("\\s+");
        if (parts.length == 0) return "U";
        if (parts.length == 1) return parts[0].substring(0, 1).toUpperCase();
        return (parts[0].substring(0, 1) + parts[parts.length - 1].substring(0, 1)).toUpperCase();
    }
}
