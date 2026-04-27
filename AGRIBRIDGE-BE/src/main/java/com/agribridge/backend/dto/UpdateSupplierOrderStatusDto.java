package com.agribridge.backend.dto;

import jakarta.validation.constraints.NotBlank;

public record UpdateSupplierOrderStatusDto(@NotBlank String status) {
}
