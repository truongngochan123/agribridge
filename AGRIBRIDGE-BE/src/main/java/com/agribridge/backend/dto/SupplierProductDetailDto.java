package com.agribridge.backend.dto;

import java.util.List;

public record SupplierProductDetailDto(
                Long id,
                Long supplierCompanyId,
                Long categoryId,
                String categoryName,
                String name,
                String unit,
                String originProvince,
                String description,
                List<String> imageUrls,
                List<SupplierCreateFlowResponseDto.CertificationSummaryDto> certifications,
                List<SupplierBatchCardDto> batches) {
}
