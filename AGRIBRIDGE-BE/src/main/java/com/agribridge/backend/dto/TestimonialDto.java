package com.agribridge.backend.dto;

import lombok.Builder;

@Builder
public record TestimonialDto(
        Long id,
        String name,
        String role,
        String company,
        String avatar,
        Integer rating,
        String comment
) {
}
