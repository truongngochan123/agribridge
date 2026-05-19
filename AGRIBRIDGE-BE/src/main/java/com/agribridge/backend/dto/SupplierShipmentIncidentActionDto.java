package com.agribridge.backend.dto;

import java.math.BigDecimal;
import java.util.List;

public record SupplierShipmentIncidentActionDto(
        String action,
        String status,
        String note,
        String proposedResolution,
        String resolutionType,
        BigDecimal compensationAmount,
        List<String> evidenceUrls) {
}
