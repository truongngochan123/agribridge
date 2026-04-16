package com.agribridge.backend.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;

public record CreateProductWithFirstBatchDto(
        @NotNull(message = "Supplier company is required") Long supplierCompanyId,
        @NotNull(message = "User id is required") Long userId,
        @Valid @NotNull(message = "Product data is required") CreateProductDto product,
        @Valid @NotNull(message = "Batch data is required") CreateBatchDto batch) {
}
