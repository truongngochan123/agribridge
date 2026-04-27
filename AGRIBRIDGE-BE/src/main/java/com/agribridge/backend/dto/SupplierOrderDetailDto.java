package com.agribridge.backend.dto;

import java.util.List;

public record SupplierOrderDetailDto(
        String id,
        Long rawId,
        String customer,
        String customerPhone,
        String customerEmail,
        String branch,
        String deliveryAddress,
        String deliveryProvince,
        String note,
            String value,
            String status,
            String statusCode,
            SupplierOrderDto.ShipmentSummaryDto shipment,
            String shipmentStatus,
            String shipmentStatusCode,
            List<String> availableActions,
            List<ShipmentEventDto> shipmentEvents,
            String orderDate,
            List<ItemDto> items) {

    public record ItemDto(
            Long id,
            Long batchId,
            String batchCode,
            String product,
            String quantity,
            String unit,
            String grade,
            String size,
            String harvestDate,
            String expiryDate,
            String price,
            String lineTotal) {
    }

    public record ShipmentEventDto(
            Long id,
            String status,
            String description,
            String location,
            String eventTime) {
    }
}
