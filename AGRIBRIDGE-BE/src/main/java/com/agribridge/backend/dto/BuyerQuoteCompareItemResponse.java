package com.agribridge.backend.dto;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

public record BuyerQuoteCompareItemResponse(
        Long id,
        Long supplierId,
        String supplierName,
        String supplierProvince,
        BigDecimal supplierRating,
        long supplierOrderCount,
        List<String> tags,
        BigDecimal price,
        BigDecimal quantity,
        BigDecimal total,
        Long batchId,
        String batchCode,
        String gradeSize,
        LocalDate harvestDate,
        Integer deliveryDays,
        LocalDate estimatedDeliveryDate,
        BigDecimal shippingFee,
        String paymentTerm,
        String note,
        String status) {
}
