package com.agribridge.backend.dto;

import com.agribridge.backend.entity.enums.QcResultEnum;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

public record PublicBatchTraceResponseDto(
        ProductTraceDto product,
        BatchTraceDto batch,
        QcTraceDto qc,
        List<CertificationTraceDto> certifications) {

    public record ProductTraceDto(
            Long id,
            String name,
            String category,
            String originProvince,
            String description,
            String unit) {
    }

    public record BatchTraceDto(
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
            String status) {
    }

    public record QcTraceDto(
            QcResultEnum result,
            String documentUrl,
            String notes) {
    }

    public record CertificationTraceDto(
            String name,
            String documentUrl,
            String issuedBy,
            LocalDate issuedDate,
            LocalDate expiryDate) {
    }
}
