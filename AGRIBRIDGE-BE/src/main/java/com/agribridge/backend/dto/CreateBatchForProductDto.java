package com.agribridge.backend.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;

public record CreateBatchForProductDto(
        @NotNull(message = "Product id is required") Long productId,
        @NotNull(message = "User id is required") Long userId,
        @Valid @NotNull(message = "Batch data is required") CreateBatchDto batch) {
}
