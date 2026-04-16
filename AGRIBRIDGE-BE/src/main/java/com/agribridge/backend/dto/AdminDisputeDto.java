package com.agribridge.backend.dto;

import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class AdminDisputeDto {

    private Long id;
    private Long orderId;
    private Long batchId;
    private Long createdByUserId;
    private Long assignedToUserId;
    private String disputeCode;
    private String status;
    private String statusLabel;
    private String severity;
    private String severityLabel;
    private String title;
    private String description;
    private String resolution;
    private String buyerName;
    private String supplierName;
    private String product;
    private String amount;
    private String createdByName;
    private String assignedToName;
    private String createdAt;
    private String resolvedAt;
}
