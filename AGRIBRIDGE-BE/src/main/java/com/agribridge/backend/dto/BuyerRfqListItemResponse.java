package com.agribridge.backend.dto;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

public record BuyerRfqListItemResponse(
        Long id,
        String code,
        String title,
        String type,
        String status,
        long quoteCount,
        LocalDateTime createdAt,
        LocalDateTime deadline,
        String product,
        String productName,
        Long productId,
        Long supplierId,
        String supplierName,
        Long categoryId,
        BigDecimal quantity,
        String unit,
        BigDecimal targetPrice,
        LocalDate deliveryDate,
        String province,
        Long branchId) {
}
