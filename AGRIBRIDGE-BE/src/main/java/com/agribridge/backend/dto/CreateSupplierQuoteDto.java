package com.agribridge.backend.dto;

import com.fasterxml.jackson.annotation.JsonAlias;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;

public record CreateSupplierQuoteDto(
        @JsonAlias("supplier_company_id")
        @NotNull(message = "Supplier company id is required") Long supplierCompanyId,
        @JsonAlias("batch_id")
        Long batchId,
        @NotNull(message = "Price is required") @DecimalMin(value = "0.01", message = "Price must be greater than 0") BigDecimal price,
        @NotNull(message = "Quantity is required") @DecimalMin(value = "0.01", message = "Quantity must be greater than 0") BigDecimal quantity,
        @JsonAlias("delivery_days")
        @NotNull(message = "Delivery days is required") @Min(value = 1, message = "Delivery days must be greater than 0") Integer deliveryDays,
        String note,
        String status) {
}
