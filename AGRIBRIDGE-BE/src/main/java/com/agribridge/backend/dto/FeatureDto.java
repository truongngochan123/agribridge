package com.agribridge.backend.dto;

import lombok.Builder;

@Builder
public record FeatureDto(
        Long id,
        String icon,
        String title,
        String description
) {
}
