package com.agribridge.backend.dto;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

public final class BuyerMarketPriceDtos {
    private BuyerMarketPriceDtos() {
    }

    public record Row(
            Long id,
            Long productTypeId,
            String productTypeName,
            String normalizedProductName,
            Long categoryId,
            String categoryName,
            String grade,
            String size,
            String gradeSize,
            String unit,
            String region,
            BigDecimal currentPrice,
            BigDecimal avgPrice,
            BigDecimal minPrice,
            BigDecimal maxPrice,
            BigDecimal changePercent,
            String changeType,
            String sourceType,
            String sourceName,
            Integer sampleCount,
            Integer supplierCount,
            LocalDate priceDate,
            LocalDateTime updatedAt,
            Boolean isAbnormal
    ) {
    }

    public record Filters(
            List<Option> categories,
            List<Option> productTypes,
            List<String> regions,
            List<String> grades,
            List<String> sizes,
            List<Option> sourceTypes,
            List<Option> dateRanges
    ) {
    }

    public record Option(String value, String label) {
    }

    public record HistoryResponse(Summary summary, List<Point> points) {
    }

    public record Summary(
            BigDecimal currentPrice,
            BigDecimal avgPrice,
            BigDecimal minPrice,
            BigDecimal maxPrice,
            BigDecimal changePercent,
            Integer sampleCount,
            Integer supplierCount
    ) {
    }

    public record Point(
            LocalDate date,
            BigDecimal avgPrice,
            BigDecimal minPrice,
            BigDecimal maxPrice,
            Integer sampleCount
    ) {
    }

    public record SupplierListing(
            String supplierName,
            Long productId,
            Long batchId,
            BigDecimal price,
            BigDecimal availableQuantity,
            String grade,
            String size,
            String unit,
            String originRegion,
            LocalDateTime updatedAt
    ) {
    }
}
