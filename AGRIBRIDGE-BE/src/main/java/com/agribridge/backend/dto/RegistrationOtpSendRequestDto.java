package com.agribridge.backend.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class RegistrationOtpSendRequestDto {

    @NotBlank
    @Email
    private String email;
}
