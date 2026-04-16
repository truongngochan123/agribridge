package com.agribridge.backend.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;

public record UpdateBatchDto(
                @NotNull(message = "User id is required") Long userId,
                @NotNull(message = "Batch data is required") @Valid CreateBatchDto batch) {
}
