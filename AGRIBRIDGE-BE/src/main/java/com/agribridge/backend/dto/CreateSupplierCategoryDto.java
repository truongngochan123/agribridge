package com.agribridge.backend.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public record CreateSupplierCategoryDto(
        @NotNull(message = "User id is required") Long userId,
        @NotBlank(message = "Category name is required") String name) {
}
