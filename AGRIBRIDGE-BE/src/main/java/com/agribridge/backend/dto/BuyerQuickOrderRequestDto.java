package com.agribridge.backend.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import java.math.BigDecimal;

public record BuyerQuickOrderRequestDto(
        @NotNull Long buyerCompanyId,
        @NotNull Long supplierId,
        @NotNull Long productId,
        @NotNull Long batchId,
        @NotNull @Positive BigDecimal quantity,
        @NotBlank String unit,
        @NotNull @DecimalMin("0") BigDecimal unitPrice,
        @NotNull @DecimalMin("0") BigDecimal subtotal,
        @NotBlank String deliveryName,
        @NotBlank String deliveryPhone,
        @NotBlank String deliveryProvince,
        String deliveryWard,
        @NotBlank String deliveryAddress,
        @NotBlank String paymentMethod,
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
