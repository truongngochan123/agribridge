package com.agribridge.backend.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

public record CreateBatchDto(
                @NotNull(message = "Harvest date is required") LocalDate harvestDate,
                LocalDate expiryDate,
                @NotBlank(message = "Grade is required") String grade,
                String size,
                @NotNull(message = "Quantity is required") @DecimalMin(value = "0.0", inclusive = false, message = "Quantity must be greater than 0") BigDecimal quantity,
                @NotNull(message = "Price is required") @DecimalMin(value = "0.0", inclusive = false, message = "Price must be greater than 0") BigDecimal price,
                @DecimalMin(value = "0.0", inclusive = true, message = "MOQ must be non-negative") BigDecimal moq,
                String storageTemp,
                String videoUrl,
                List<String> imageUrls,
                @Valid @NotNull(message = "QC record is required") CreateQcRecordDto qc) {
}
