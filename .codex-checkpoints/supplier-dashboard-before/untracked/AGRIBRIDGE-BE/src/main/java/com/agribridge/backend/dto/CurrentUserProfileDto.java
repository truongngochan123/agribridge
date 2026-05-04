package com.agribridge.backend.dto;

public record CurrentUserProfileDto(
        Long userId,
        Long companyId,
        String fullName,
        String email,
        String phone,
        String roleLabel,
        String accountCode,
        String companyType,
        String companyTypeLabel,
        String joinedAt,
        String statusLabel,
        String initials,
        String companyName,
        String taxCode,
        String registrationNumber,
        String establishedYear,
        String website,
        String province,
        String district,
        String ward,
        String address,
        String description,
        String ownerName,
        String businessTypeLabel
) {
}
