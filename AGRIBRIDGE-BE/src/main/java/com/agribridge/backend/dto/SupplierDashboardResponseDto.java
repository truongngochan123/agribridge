package com.agribridge.backend.dto;

import java.util.List;

public record SupplierDashboardResponseDto(
        List<MetricCardDto> overviewCards,
        List<RevenuePointDto> monthlyRevenue,
        List<ActivityDto> recentActivities,
        List<ProductLotDto> productLots,
        List<RfqDto> rfqItems,
        List<OrderDto> orders,
        List<ShipmentDto> shipments,
        List<MetricCardDto> debtSummaryCards,
        List<DebtCustomerDto> debtCustomers) {

    public record MetricCardDto(String label, String value, String subLabel, String trend) {
    }

    public record RevenuePointDto(String month, long value) {
    }

    public record ActivityDto(String id, String title, String meta, String time) {
    }

    public record ProductLotDto(
            String id,
            String name,
            String lotCode,
            String grade,
            String size,
            String stock,
            String moq,
            String price,
            String status,
            String image) {
    }

    public record RfqDto(
            String id,
            String customer,
            String product,
            String category,
            String quantity,
            String targetPrice,
            String supplierQuotedPrice,
            String supplierQuotedQuantity,
            String dueDate,
            String deliveryDate,
            String province,
            String description,
            long quoteCount,
            String supplierQuoteStatus,
            Integer supplierDeliveryDays,
            String supplierQuoteNote,
            boolean hasExistingQuote,
            String status,
            Long quoteId,
            String quoteStatus,
            Long orderId) {
    }

    public record OrderDto(
            String id,
            String customer,
            String branch,
            String product,
            String quantity,
            String value,
            String status,
            String orderDate) {
    }

    /** Extended shipment row — contains all fields needed by SupplierDeliveryPage (no hard-coded values). */
    public record ShipmentDto(
            String id,
            String orderRef,
            String route,
            String driver,
            String phone,
            String eta,
            String cargo,
            int progress,
            String status,
            // Extended fields
            String shippingFee,
            String receiverName,
            String receiverPhone,
            String receiverAddress,
            String providerName,
            String serviceName,
            String estimatedDeliveryTime,
            String createdAt,
            Long rawOrderId,
            Long rawShipmentId,
            List<ShipmentEventDto> shipmentEvents,
            List<ShipmentIncidentDto> incidents) {
    }

    public record ShipmentEventDto(
            Long id,
            String status,
            String description,
            String location,
            String eventTime) {
    }

    public record ShipmentIncidentDto(
            Long id,
            String incidentType,
            String severity,
            String description,
            Integer affectedQuantity,
            Integer missingQuantity,
            Integer damagedQuantity,
            String status,
            String createdAt,
            String updatedAt,
            String resolvedAt,
            String resolutionNote,
            String buyerNotes,
            String supplierResponse,
            String proposedResolution,
            String resolutionType,
            List<String> evidenceUrls,
            List<String> supplierEvidenceUrls,
            int attachmentCount,
            List<ShipmentEventDto> timeline) {
    }

    public record DebtCustomerDto(
            String customer,
            String cycle,
            String terms,
            String totalDebt,
            String overdueDebt,
            String creditLimit,
            String status) {
    }
}
