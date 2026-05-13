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
        boolean quoteOnly,
        String shopIdUsed,
        Integer fromDistrictId,
        String fromWardCode,
        Integer toDistrictId,
        String toWardCode,
        Integer weight,
        Integer length,
        Integer width,
        Integer height,
        Integer serviceTypeId,
        Integer serviceId,
        BigDecimal insuranceValue,
        String rawQuoteRequest,
        String rawQuoteResponse) {
}
