package com.agribridge.backend.dto;

import com.fasterxml.jackson.annotation.JsonAlias;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

public record CreateBuyerRfqRequest(
        @NotNull(message = "title is required") String title,
        String type,
        @JsonAlias("supplier_id") Long supplierId,
        @JsonAlias("supplier_company_id") Long supplierCompanyId,
        @JsonAlias("product_name") String productName,
        @JsonAlias("product_id") Long productId,
        @JsonAlias("category_id") Long categoryId,
        @JsonAlias("branch_id") Long branchId,
        @NotNull(message = "quantity is required") @DecimalMin(value = "0.01", message = "quantity must be greater than 0") BigDecimal quantity,
        @NotNull(message = "unit is required") String unit,
        String province,
        @JsonAlias("delivery_date") LocalDate deliveryDate,
        @JsonAlias("expired_at") @NotNull(message = "expiredAt is required") LocalDateTime expiredAt,
        String description) {
}
