package com.agribridge.backend.dto;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

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
        boolean isSaved,
        List<String> imageUrls,
        List<CertificationPreviewDto> certifications,
        List<BatchPreviewDto> batches) {

    public record CertificationPreviewDto(
            Long id,
            String name,
            String documentUrl,
            String issuedBy,
            LocalDate issuedDate,
            LocalDate expiryDate) {
    }

    public record BatchPreviewDto(
            Long id,
            String batchCode,
            String grade,
            String size,
            BigDecimal quantity,
            BigDecimal price,
            String status) {
    }
}
