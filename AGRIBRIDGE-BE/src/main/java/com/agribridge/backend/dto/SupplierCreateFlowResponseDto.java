package com.agribridge.backend.dto;

import com.agribridge.backend.entity.enums.QcResultEnum;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

public record SupplierCreateFlowResponseDto(
        ProductSummaryDto product,
        BatchSummaryDto batch,
        QcSummaryDto qc,
        List<CertificationSummaryDto> certifications) {

    public record ProductSummaryDto(
            Long id,
            String name,
            String unit,
            Long categoryId,
            String categoryName,
            String originProvince,
            String description,
            String imageUrl) {
    }

    public record BatchSummaryDto(
            Long id,
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
            Boolean expired,
            String warningMessage,
            Integer daysUntilExpiry,
            String soonExpiryWarning,
            Boolean canEditExpiry,
            Boolean canCreateNewBatchFromThis) {
    }

    public record QcSummaryDto(
            Long id,
            QcResultEnum result,
            String documentUrl,
            String notes) {
    }

    public record CertificationSummaryDto(
            Long id,
            String name,
            String documentUrl,
            String issuedBy,
            LocalDate issuedDate,
            LocalDate expiryDate) {
    }
}
