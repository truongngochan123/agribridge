package com.agribridge.backend.dto;

import jakarta.validation.constraints.NotNull;

public record RejectSupplierRfqDto(
        @NotNull(message = "Supplier company id is required") Long supplierCompanyId,
        String note) {
}
