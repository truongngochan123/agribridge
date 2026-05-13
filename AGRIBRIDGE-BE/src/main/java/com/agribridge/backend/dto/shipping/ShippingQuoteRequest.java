package com.agribridge.backend.dto.shipping;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;

public record ShippingQuoteRequest(
        Long buyerCompanyId,
        Long supplierId,
        @NotNull Long productId,
        Long batchId,
        @NotNull @DecimalMin("0.01") BigDecimal quantity,
        @NotNull String unit,
        String toProvince,
        String toDistrict,
        String toWard,
        String toAddress,
        Integer weight,
        Integer length,
        Integer width,
        Integer height,
        BigDecimal insuranceValue) {
}
