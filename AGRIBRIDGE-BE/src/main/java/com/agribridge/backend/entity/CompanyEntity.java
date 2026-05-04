package com.agribridge.backend.entity;

import com.agribridge.backend.entity.enums.BusinessTypeEnum;
import com.agribridge.backend.entity.enums.CompanyTypeEnum;
import com.agribridge.backend.entity.enums.VerificationStatusEnum;
import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "companies")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CompanyEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String name;

    @Enumerated(EnumType.STRING)
    @Column(name = "company_type", nullable = false)
    private CompanyTypeEnum companyType;

    @Enumerated(EnumType.STRING)
    @Column(name = "business_type", nullable = false)
    private BusinessTypeEnum businessType;

    @Column(name = "owner_name", nullable = false)
    private String ownerName;

    @Column(name = "citizen_id")
    private String citizenId;

    @Column(name = "tax_code")
    private String taxCode;

    @Column(name = "registration_number")
    private String registrationNumber;

    @Column(name = "established_year")
    private Integer establishedYear;

    @Column(name = "website")
    private String website;

    @Column(nullable = false)
    private String phone;

    @Column
    private String email;

    @Column(nullable = false)
    private String address;

    @Column(nullable = false)
    private String province;

    @Column
    private String ward;

    @Column
    private String description;

    @Column(name = "verified_status", nullable = false)
    private Boolean verifiedStatus;

    @Enumerated(EnumType.STRING)
    @Column(name = "verification_status")
    private VerificationStatusEnum verificationStatus;

    @Column(name = "verification_note", length = 500)
    private String verificationNote;

    @Column(name = "verification_score")
    private Integer verificationScore;

    @Column(name = "verification_reason", length = 1000)
    private String verificationReason;

    @Column(name = "tax_lookup_status", length = 50)
    private String taxLookupStatus;

    @Column(name = "tax_lookup_provider", length = 50)
    private String taxLookupProvider;

    @Column(name = "identity_document_url", length = 500)
    private String identityDocumentUrl;

    @Column(name = "business_license_url", length = 500)
    private String businessLicenseUrl;

    @Column(name = "trust_level")
    private String trustLevel;

    @Column(name = "credit_limit")
    private BigDecimal creditLimit;

    @Column(name = "verified_at")
    private LocalDateTime verifiedAt;

    @Column(name = "verified_by_user_id")
    private Long verifiedByUserId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "verified_by_user_id", insertable = false, updatable = false)
    @JsonIgnore
    private UserEntity verifiedByUser;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;
}
