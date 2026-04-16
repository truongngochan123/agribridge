package com.agribridge.backend.dto;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class RegistrationAvailabilityRequestDto {

    private String role;
    private String phone;
    private String email;
    private String taxCode;
    private String citizenId;
}
