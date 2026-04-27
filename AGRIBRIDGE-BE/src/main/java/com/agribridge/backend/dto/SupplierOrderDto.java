package com.agribridge.backend.dto;

import java.util.List;

public record SupplierOrderDto(
        String id,
        Long rawId,
        String customer,
        String branch,
        String product,
        List<OrderItemSummaryDto> items,
        String quantity,
        String value,
        String status,
        String statusCode,
        ShipmentSummaryDto shipment,
        String shipmentStatus,
        String shipmentStatusCode,
        List<String> availableActions,
        String orderDate) {

    public record OrderItemSummaryDto(
            Long id,
            Long batchId,
            String batchCode,
            String product,
            String quantity,
            String unit,
            String grade,
            String size,
            String price,
            String harvestDate,
            String expiryDate) {
    }

    public record ShipmentSummaryDto(
            Long id,
            String status,
            String statusCode,
            String trackingCode,
            String carrierName,
            String shippingMethod,
            String driverName,
            String driverPhone,
            String vehicleInfo,
            String shippingFee,
            String shippedAt,
            String deliveredAt) {
    }
}
