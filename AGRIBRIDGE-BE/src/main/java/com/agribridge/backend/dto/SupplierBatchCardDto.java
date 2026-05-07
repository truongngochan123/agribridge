package com.agribridge.backend.dto;

import java.math.BigDecimal;
import java.time.LocalDate;

public record SupplierBatchCardDto(
                Long id,
                String batchCode,
                String qrCode,
                String grade,
                String size,
                BigDecimal quantity,
                BigDecimal moq,
                BigDecimal price,
                String status,
                String statusLabel,
                LocalDate harvestDate,
                LocalDate expiryDate,
                String productUnit,
                String productName,
                String imageUrl,
                Boolean expired,
                String warningMessage,
                Integer daysUntilExpiry,
                String soonExpiryWarning,
                Boolean canEditExpiry,
                Boolean canCreateNewBatchFromThis) {
}
