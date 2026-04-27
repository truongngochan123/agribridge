package com.agribridge.backend.dto;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

public record BuyerBatchPreviewDto(
        Long id,
        String batchCode,
        String code,
        String grade,
        String size,
        BigDecimal quantity,
        BigDecimal availableQuantity,
        BigDecimal price,
        BigDecimal moq,
        BigDecimal minMoq,
        LocalDate harvestDate,
        LocalDate expiryDate,
        String status,
        String imageUrl,
        List<String> imageUrls,
        String qcResult,
        String qcDocumentUrl,
        String qcNotes,
        String videoUrl,
        String storageTemp,
        String notes,
        String description) {
}
