package com.agribridge.backend.dto;

import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class RegistrationAvailabilityResponseDto {

    private boolean phoneTaken;
    private boolean emailTaken;
    private boolean taxCodeTaken;
    private boolean citizenIdTaken;
    private String normalizedPhone;
    private String normalizedEmail;
    private String normalizedTaxCode;
    private String businessTypeHint;
    private boolean taxCodeValid;
    private boolean citizenIdValid;
}
