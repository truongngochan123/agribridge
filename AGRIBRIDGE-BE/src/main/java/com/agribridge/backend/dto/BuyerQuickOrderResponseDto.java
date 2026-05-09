package com.agribridge.backend.dto;

import java.math.BigDecimal;

public record BuyerQuickOrderResponseDto(
        Long orderId,
        String orderCode,
        Long invoiceId,
        Long shipmentId,
        Long paymentId,
        Long debtId,
        String orderStatus,
        String invoiceStatus,
        String paymentStatus,
        String escrowStatus,
        String transferContent,
        BigDecimal payableAmount,
        BigDecimal depositAmount,
        BigDecimal remainingAmount,
        String shippingStatus,
        BigDecimal grandTotal,
        String message) {
}
