package com.agribridge.backend.dto;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

public final class BuyerDeliveryDtos {

    private BuyerDeliveryDtos() {
    }

    public record ListItem(
            Long shipmentId,
            String id,
            String trackingCode,
            String orderRef,
            String supplierName,
            String productsText,
            String destination,
            Long branchId,
            String branchName,
            String driverName,
            String driverPhone,
            String vehicleInfo,
            String carrierName,
            BigDecimal shippingFee,
            LocalDateTime estimatedDeliveryAt,
            String estimatedDeliveryTime,
            LocalDateTime shippedAt,
            LocalDateTime deliveredAt,
            LocalDateTime confirmedReceivedAt,
            String currentLocation,
            BigDecimal currentLat,
            BigDecimal currentLng,
            String status,
            String statusLabel,
            int progress,
            String receiverName,
            String receiverPhone,
            String deliveryAddress,
            String buyerName,
            String buyerPhone,
            String branchContactName,
            String branchPhone,
            String branchAddress
    ) {
    }

    public record Detail(
            ListItem shipment,
            List<ProductItem> products,
            List<TimelineEvent> timeline,
            List<Incident> incidents,
            List<Complaint> complaints,
            PaymentDueInfo paymentDue
    ) {
    }

    public record PaymentDueInfo(
            Long invoiceId,
            String invoiceCode,
            String displayInvoiceCode,
            Long orderId,
            String orderCode,
            String supplierName,
            String productName,
            BigDecimal quantity,
            String unit,
            BigDecimal totalAmount,
            BigDecimal paidAmount,
            BigDecimal remainingAmount,
            LocalDate dueDate,
            String transferContent,
            String paymentMethod
    ) {
    }

    public record ProductItem(
            Long productId,
            String productName,
            Long batchId,
            String batchCode,
            String grade,
            String size,
            BigDecimal quantity,
            String unit,
            BigDecimal price,
            BigDecimal subtotal,
            String batchUrl
    ) {
    }

    public record TimelineEvent(
            Long id,
            String status,
            String statusLabel,
            String location,
            String description,
            LocalDateTime eventTime
    ) {
    }

    public record Incident(
            Long id,
            String incidentType,
            String description,
            String imageUrl,
            String status,
            LocalDateTime createdAt,
            LocalDateTime resolvedAt,
            String resolutionNote,
            Integer missingQuantity,
            Integer damagedQuantity,
            String updateNote,
            List<String> evidenceUrls,
            LocalDateTime updatedAt
    ) {
    }

    public record Complaint(
            Long id,
            Long batchId,
            String title,
            String description,
            String status,
            String severity,
            LocalDateTime createdAt,
            LocalDateTime resolvedAt
    ) {
    }

    public record ConfirmReceivedRequest(
            String condition,
            String note,
            String evidenceImage,
            Boolean confirmed
    ) {
    }

    public record IncidentRequest(
            String incidentType,
            String description,
            String imageUrl,
            Integer missingQuantity,
            Integer damagedQuantity
    ) {
    }

    public record UpdateIncidentRequest(
            String note,
            Integer missingQuantity,
            Integer damagedQuantity,
            String imageUrl,
            List<String> evidenceUrls
    ) {
    }
}
