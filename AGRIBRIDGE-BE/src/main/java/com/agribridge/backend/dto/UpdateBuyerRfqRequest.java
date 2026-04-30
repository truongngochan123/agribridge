package com.agribridge.backend.dto;

import com.fasterxml.jackson.annotation.JsonAlias;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

public record UpdateBuyerRfqRequest(
        String title,
        BigDecimal quantity,
        @JsonAlias("delivery_date") LocalDate deliveryDate,
        @JsonAlias("expired_at") LocalDateTime expiredAt,
        String province,
        String description,
        @JsonAlias("branch_id") Long branchId) {
}
