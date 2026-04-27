package com.agribridge.backend.dto;

import java.math.BigDecimal;

public record CreateSupplierShipmentDto(
        String carrierName,
        String shippingMethod,
        String driverName,
        String driverPhone,
        String vehicleInfo,
        BigDecimal shippingFee,
        String trackingCode,
        String note) {
}
