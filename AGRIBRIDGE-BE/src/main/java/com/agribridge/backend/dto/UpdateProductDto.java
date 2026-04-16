package com.agribridge.backend.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;

public record UpdateProductDto(
                @NotNull(message = "Product data is required") @Valid CreateProductDto product) {
}
