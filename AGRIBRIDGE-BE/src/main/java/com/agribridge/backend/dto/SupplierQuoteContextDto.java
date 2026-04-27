package com.agribridge.backend.dto;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

public record SupplierQuoteContextDto(
        RfqContextDto rfq,
        ProductContextDto product,
        List<BatchContextDto> batches) {

    public record RfqContextDto(
            Long id,
            Long buyerCompanyId,
            Long productId,
            Long categoryId,
            BigDecimal quantity,
            String unit,
            LocalDate deliveryDate,
            String province,
            String description,
            LocalDateTime expiredAt,
            String status) {
    }

    public record ProductContextDto(
            Long id,
            String name,
            Long categoryId,
            String unit) {
    }

    public record BatchContextDto(
            Long id,
            Long productId,
            BigDecimal quantity,
            String unit,
            BigDecimal price,
            String grade,
            String size,
            LocalDate harvestDate,
            LocalDate expiryDate,
            String storageTemp,
            String status) {
    }
}
