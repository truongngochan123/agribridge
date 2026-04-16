package com.agribridge.backend.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;

public record CreateProductOnlyDto(
                @NotNull(message = "Supplier company is required") Long supplierCompanyId,
                @Valid @NotNull(message = "Product data is required") CreateProductDto product) {
}
