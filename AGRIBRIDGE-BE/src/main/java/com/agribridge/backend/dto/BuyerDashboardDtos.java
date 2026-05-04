package com.agribridge.backend.dto;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

public final class BuyerDashboardDtos {
    private BuyerDashboardDtos() {
    }

    public record Response(
            List<Kpi> kpis,
            List<Alert> alerts,
            List<DeliveryOrder> deliveryOrders,
            List<PendingRfq> pendingRfqs
    ) {
    }

    public record Kpi(String id, String label, BigDecimal value, String displayValue) {
    }

    public record Alert(String id, String title, String value, String tone, String targetPath) {
    }

    public record DeliveryOrder(
            Long orderId,
            String orderCode,
            String productText,
            String status,
            String statusLabel,
            BigDecimal totalAmount,
            String displayAmount,
            Long shipmentId,
            String trackingCode,
            LocalDateTime estimatedDeliveryAt
    ) {
    }

    public record PendingRfq(
            Long rfqId,
            String rfqCode,
            String title,
            String productText,
            BigDecimal quantity,
            String unit,
            String status,
            Integer quoteCount,
            LocalDateTime expiredAt,
            LocalDate deliveryDate,
            String province
    ) {
    }
}
