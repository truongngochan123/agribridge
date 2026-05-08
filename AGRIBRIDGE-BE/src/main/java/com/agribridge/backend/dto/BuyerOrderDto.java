package com.agribridge.backend.dto;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

public record BuyerOrderDto(
        String id,
        Long orderId,
        String supplier,
        Long supplierCompanyId,
        Long buyerCompanyId,
        String branch,
        Long branchId,
        Long quoteId,
        String rfqCode,
        String status,
        String product,
        String quantity,
        List<ItemDto> items,
        BigDecimal subtotal,
        BigDecimal shippingFee,
        BigDecimal totalAmount,
        String value,
        String paymentMethod,
        String paymentOption,
        String paymentStatus,
        String escrowStatus,
        BigDecimal depositRate,
        BigDecimal depositAmount,
        BigDecimal balanceAmount,
        BigDecimal remainingAmount,
        String deliveryName,
        String deliveryPhone,
        String deliveryProvince,
        String deliveryDistrict,
        String deliveryWard,
        String deliveryAddress,
        String shippingProviderCode,
        String shippingProviderName,
        String shippingServiceName,
        String shippingPayer,
        String estimatedDeliveryTime,
        LocalDateTime expectedDeliveryDate,
        ShipmentDto shipment,
        List<TrackingEventDto> trackingEvents,
        String driverName,
        String driverPhone,
        String vehicleInfo,
        String trackingCode,
        String invoiceCode,
        BigDecimal invoicePaidAmount,
        LocalDate invoiceDueDate,
        String invoiceStatus,
        List<PaymentDto> payments,
        List<ComplaintDto> complaints,
        String note,
        LocalDateTime createdAt
) {
    public record ItemDto(
            Long batchId,
            String batchCode,
            Long productId,
            String productName,
            String grade,
            String size,
            LocalDate harvestDate,
            BigDecimal quantity,
            String unit,
            BigDecimal price,
            BigDecimal subtotal
    ) {
    }

    public record TrackingEventDto(
            String title,
            String time,
            boolean done,
            String status,
            String location
    ) {
    }

    public record PaymentDto(
            Long id,
            BigDecimal amount,
            BigDecimal paidAmount,
            String paymentMethod,
            String paymentType,
            String status,
            String escrowStatus,
            String transferContent,
            LocalDate dueDate,
            LocalDateTime paymentDate,
            LocalDateTime paidAt,
            LocalDateTime verifiedAt,
            String note
    ) {
    }

    public record ShipmentDto(
            Long id,
            String provider,
            String trackingCode,
            String shipmentStatus,
            String receiverName,
            String receiverPhone,
            String receiverAddress,
            LocalDateTime expectedDeliveryDate,
            BigDecimal shippingFee,
            LocalDateTime deliveredAt
    ) {
    }

    public record ComplaintDto(
            Long id,
            Long batchId,
            String title,
            String description,
            String status,
            String severity,
            String resolution,
            LocalDateTime createdAt,
            LocalDateTime resolvedAt
    ) {
    }
}
