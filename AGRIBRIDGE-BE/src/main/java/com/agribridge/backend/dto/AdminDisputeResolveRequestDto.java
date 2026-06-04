package com.agribridge.backend.dto;

import java.math.BigDecimal;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class AdminDisputeResolveRequestDto {

    private Long assignedToUserId;
    private String decisionType;
    private BigDecimal refundAmount;
    private BigDecimal compensationAmount;
    private String resolution;
    private Boolean releaseRemainingToSupplier;
}
