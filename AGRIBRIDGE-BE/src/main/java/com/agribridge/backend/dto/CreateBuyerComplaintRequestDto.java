package com.agribridge.backend.dto;

import jakarta.validation.constraints.NotBlank;

public record CreateBuyerComplaintRequestDto(
        Long batchId,
        @NotBlank String title,
        @NotBlank String description,
        String severity
) {
}
