package com.agribridge.backend.dto;

import java.math.BigDecimal;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class AdminDisputeRefundRequestDto {
    private BigDecimal refundAmount;
    private String reason;
}
