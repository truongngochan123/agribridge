package com.agribridge.backend.dto;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

public record BuyerRfqCompareResponse(
        RfqCompareSummary rfq,
        List<BuyerQuoteCompareItemResponse> quotes) {

    public record RfqCompareSummary(
            Long id,
            String code,
            String title,
            String product,
            BigDecimal quantity,
            String unit,
            BigDecimal targetPrice,
            LocalDateTime deadline,
            LocalDate deliveryDate,
            String province,
            String deliveryAddress) {
    }
}
