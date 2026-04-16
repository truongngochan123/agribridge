package com.agribridge.backend.dto;

import lombok.Builder;

@Builder
public record MarketPriceDto(
        Long id,
        String name,
        String image,
        String price,
        String unit,
        String region,
        String trend
) {
}
