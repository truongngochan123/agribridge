package com.agribridge.backend.dto;

import jakarta.validation.constraints.NotBlank;

public record PostRfqMessageDto(
        Long supplierCompanyId,
        @NotBlank String message) {
}
