package com.agribridge.backend.dto;

import com.agribridge.backend.entity.enums.BusinessTypeEnum;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import java.util.ArrayList;
import java.util.List;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class CreateSupplierRegistrationDto {

    private String companyName;

    private BusinessTypeEnum businessType;

    private String ownerName;

    private String citizenId;

    private String taxCode;

    private String companyPhone;

    @Email
    private String companyEmail;

    private String address;

    private String province;

    private String ward;

    private String description;

    private String logoUrl;

    private List<String> documentUrls = new ArrayList<>();

    @NotBlank
    private String fullName;

    @NotBlank
    private String loginPhone;

    @NotBlank
    @Email
    private String loginEmail;

    @NotBlank
    private String password;
}
