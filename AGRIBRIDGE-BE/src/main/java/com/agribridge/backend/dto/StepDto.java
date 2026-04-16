package com.agribridge.backend.dto;

import lombok.Builder;

@Builder
public record StepDto(
        String stepNumber,
        String title,
        String description,
        String icon
) {
}
