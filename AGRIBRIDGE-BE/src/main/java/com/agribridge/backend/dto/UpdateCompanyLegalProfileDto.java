package com.agribridge.backend.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class UpdateCompanyLegalProfileDto {

    @NotBlank
    private String name;

    private String taxCode;

    private String registrationNumber;

    private Integer establishedYear;

    private String website;

    @NotBlank
    private String province;

    private String ward;

    @NotBlank
    private String address;

    private String description;
}
