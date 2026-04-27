package com.agribridge.backend.dto;

import java.math.BigDecimal;

public record BuyerSourcingProductDto(
        Long productId,
        String productName,
        String description,
        Long supplierCompanyId,
        String supplierName,
        Long categoryId,
        String categoryName,
        String originRegion,
        String unit,
        String imageUrl,
        BigDecimal minPrice,
        BigDecimal maxPrice,
        BigDecimal totalAvailableQuantity,
        BigDecimal minMoq,
        long availableBatchCount,
        String gradeSummary,
        String sizeSummary,
        long certificationCount,
        boolean hasAvailableStock,
        boolean isSaved) {
}
