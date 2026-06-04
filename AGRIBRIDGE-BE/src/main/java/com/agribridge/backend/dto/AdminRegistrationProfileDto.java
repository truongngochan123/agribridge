package com.agribridge.backend.dto;

import java.util.List;
import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class AdminRegistrationProfileDto {

    private String id;
    private Long userId;
    private Long companyId;
    private String companyType;
    private String businessType;
    private String companyName;
    private String ownerName;
    private String fullName;
    private String role;
    private String phone;
    private String email;
    private String address;
    private String province;
    private String district;
    private String ward;
    private String taxCode;
    private String registrationNumber;
    private String citizenId;
    private String description;
    private String createdAt;
    private String verificationStatus;
    private String verificationStatusLabel;
    private String verificationNote;
    private Integer verificationScore;
    private String verificationReason;
    private List<String> reasonCodes;
    private String lastProcessedAt;
    private Long lastProcessedByUserId;
    private String lastProcessedByName;
    private List<AdminUploadedDocumentDto> documents;
    private List<String> companyImages;
}
