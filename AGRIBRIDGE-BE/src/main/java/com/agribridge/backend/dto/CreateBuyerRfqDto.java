package com.agribridge.backend.dto;

import com.fasterxml.jackson.annotation.JsonAlias;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

public record CreateBuyerRfqDto(
        @JsonAlias("buyer_company_id")
        @NotNull Long buyerCompanyId,
        @JsonAlias("product_id")
        @NotNull Long productId,
        @JsonAlias("category_id")
        Long categoryId,
        @NotNull @DecimalMin("0.01") BigDecimal quantity,
        @NotNull String unit,
        @JsonAlias("delivery_date")
        LocalDate deliveryDate,
        String province,
        String description,
        @JsonAlias("expired_at")
        LocalDateTime expiredAt) {
}
