package com.agribridge.backend.dto;

import com.agribridge.backend.entity.enums.QcResultEnum;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

public record SupplierBatchDetailDto(
                Long id,
                Long productId,
                String productName,
                String productUnit,
                String batchCode,
                String qrCode,
                LocalDate harvestDate,
                LocalDate expiryDate,
                String grade,
                String size,
                BigDecimal quantity,
                BigDecimal price,
                BigDecimal moq,
                String storageTemp,
                String videoUrl,
                String status,
                String statusLabel,
                List<String> imageUrls,
                QcResultEnum qcResult,
                String qcDocumentUrl,
                String qcNotes,
                Boolean expired,
                String warningMessage,
                Integer daysUntilExpiry,
                String soonExpiryWarning,
                Boolean canEditExpiry,
                Boolean canCreateNewBatchFromThis) {
}
