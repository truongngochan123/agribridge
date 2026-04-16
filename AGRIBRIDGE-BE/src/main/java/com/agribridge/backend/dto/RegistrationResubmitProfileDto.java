package com.agribridge.backend.dto;

import java.util.List;
import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class RegistrationResubmitProfileDto {

    private Long companyId;
    private Long userId;
    private String companyType;
    private String businessType;
    private String companyName;
    private String ownerName;
    private String fullName;
    private String loginPhone;
    private String loginEmail;
    private String citizenId;
    private String taxCode;
    private String registrationNumber;
    private String companyPhone;
    private String companyEmail;
    private String address;
    private String province;
    private String district;
    private String description;
    private String logoUrl;
    private List<AdminUploadedDocumentDto> documents;
    private String verificationStatus;
    private String verificationNote;
}
