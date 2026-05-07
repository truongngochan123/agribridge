package com.agribridge.backend.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import java.math.BigDecimal;

public record BuyerQuickOrderRequestDto(
        Long buyerCompanyId,
        Long supplierId,
        Long branchId,
        @NotNull(message = "productId is required") Long productId,
        @NotNull(message = "batchId is required") Long batchId,
        @NotNull(message = "quantity is required") @Positive(message = "quantity must be greater than 0") BigDecimal quantity,
        String unit,
        @DecimalMin(value = "0", message = "unitPrice must be greater than or equal to 0") BigDecimal unitPrice,
        @DecimalMin(value = "0", message = "subtotal must be greater than or equal to 0") BigDecimal subtotal,
        String deliveryName,
        String deliveryPhone,
        String deliveryProvince,
        String deliveryWard,
        String deliveryAddress,
        String paymentMethod,
        String paymentOption,
        BigDecimal depositRate,
        BigDecimal depositAmount,
        BigDecimal balanceAmount,
        Integer creditTermDays,
        BigDecimal shippingFee,
        String shippingProviderCode,
        String shippingProviderName,
        String shippingServiceName,
        String estimatedDeliveryTime,
        String shippingPayer,
        String shippingStatus,
        String orderStatus,
        String note) {
}
