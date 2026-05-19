package com.agribridge.backend.dto;

import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class ForgotPasswordResponseDto {

    private boolean success;
    private boolean verified;
    private String email;
    private String message;
    private long expiresInSeconds;
    private long resendAfterSeconds;
}
