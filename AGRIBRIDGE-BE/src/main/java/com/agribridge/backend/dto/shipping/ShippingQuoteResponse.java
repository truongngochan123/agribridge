package com.agribridge.backend.dto.shipping;

import java.math.BigDecimal;

public record ShippingQuoteResponse(
        String providerCode,
        String providerName,
        String serviceName,
        BigDecimal estimatedShippingFee,
        String estimatedDeliveryTime,
        Integer estimatedDaysMin,
        Integer estimatedDaysMax,
        String shippingPayer,
        boolean quoteOnly) {
}
