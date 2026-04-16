package com.agribridge.backend.dto;

import lombok.Builder;

import java.util.List;

@Builder
public record CtaBlockDto(
        String title,
        String subtitle,
        String ctaText,
        List<String> stats
) {
}
