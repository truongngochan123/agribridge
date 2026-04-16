package com.agribridge.backend.dto;

import lombok.Builder;

@Builder
public record HeroStatsDto(
        String supplierCount,
        String buyerCount,
        String transactionValue,
        String rfqCount
) {
}
