package com.agribridge.backend.dto;

import java.math.BigDecimal;

public record ConvertQuoteToOrderResponse(
        Long orderId,
        Long invoiceId,
        Long quoteId,
        Long rfqId,
        BigDecimal totalAmount,
        String orderStatus,
        String invoiceStatus) {
}
