package com.agribridge.backend.dto;

import jakarta.validation.constraints.NotBlank;
import java.util.ArrayList;
import java.util.List;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class RegistrationResubmitRequestDto {

    private Long companyId;
    private Long userId;

    @NotBlank
    private String companyName;

    @NotBlank
    private String ownerName;

    @NotBlank
    private String fullName;

    @NotBlank
    private String loginPhone;

    private String loginEmail;
    private String citizenId;
    private String taxCode;
    private String registrationNumber;
    private String companyPhone;
    private String companyEmail;

    @NotBlank
    private String address;

    @NotBlank
    private String province;

    private String ward;
    private String description;
    private String logoUrl;
    private List<String> documentUrls = new ArrayList<>();
}
