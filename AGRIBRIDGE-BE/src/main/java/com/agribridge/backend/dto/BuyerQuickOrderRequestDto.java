package com.agribridge.backend.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import java.math.BigDecimal;

public record BuyerQuickOrderRequestDto(
        @NotNull(message = "buyerCompanyId is required") Long buyerCompanyId,
        @NotNull(message = "supplierId is required") Long supplierId,
        @NotNull(message = "productId is required") Long productId,
        @NotNull(message = "batchId is required") Long batchId,
        @NotNull(message = "quantity is required") @Positive(message = "quantity must be greater than 0") BigDecimal quantity,
        @NotBlank(message = "unit is required") String unit,
        @NotNull(message = "unitPrice is required") @DecimalMin(value = "0", message = "unitPrice must be greater than or equal to 0") BigDecimal unitPrice,
        @NotNull(message = "subtotal is required") @DecimalMin(value = "0", message = "subtotal must be greater than or equal to 0") BigDecimal subtotal,
        @NotBlank(message = "deliveryName is required") String deliveryName,
        @NotBlank(message = "deliveryPhone is required") String deliveryPhone,
        @NotBlank(message = "deliveryProvince is required") String deliveryProvince,
        @NotBlank(message = "deliveryWard is required") String deliveryWard,
        @NotBlank(message = "deliveryAddress is required") String deliveryAddress,
        @NotBlank(message = "paymentMethod is required") String paymentMethod,
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
