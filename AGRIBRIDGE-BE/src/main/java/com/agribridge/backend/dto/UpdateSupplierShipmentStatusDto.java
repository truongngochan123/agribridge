package com.agribridge.backend.dto;

import jakarta.validation.constraints.NotBlank;

public record UpdateSupplierShipmentStatusDto(
        @NotBlank String status) {
}
