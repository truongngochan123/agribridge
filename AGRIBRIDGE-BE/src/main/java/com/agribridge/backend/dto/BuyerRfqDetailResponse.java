package com.agribridge.backend.dto;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

public record BuyerRfqDetailResponse(
        Long id,
        String code,
        String title,
        String description,
        String type,
        String status,
        long quoteCount,
        LocalDateTime createdAt,
        LocalDateTime deadline,
        Long productId,
        String product,
        String productName,
        Long supplierId,
        String supplierName,
        Long categoryId,
        String category,
        BigDecimal quantity,
        String unit,
        BigDecimal targetPrice,
        LocalDate deliveryDate,
        String province,
        BranchSummary branch) {

    public record BranchSummary(
            Long id,
            String name,
            String address,
            String deliveryAddress,
            String province,
            String phone) {
    }
}
