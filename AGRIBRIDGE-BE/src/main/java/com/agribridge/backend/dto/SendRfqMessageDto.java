package com.agribridge.backend.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public record SendRfqMessageDto(
        @NotNull Long rfqId,
        @NotNull Long senderUserId,
        @NotNull Long senderCompanyId,
        @NotBlank String senderRole,
        @NotBlank String message) {
}
