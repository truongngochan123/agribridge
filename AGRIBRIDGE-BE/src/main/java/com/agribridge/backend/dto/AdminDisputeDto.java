package com.agribridge.backend.dto;

import java.math.BigDecimal;
import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class AdminDisputeDto {

    private Long id;
    private Long orderId;
    private Long batchId;
    private Long shipmentId;
    private String sourceType;
    private String sourceLabel;
    private Long sourceId;
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
    private String decisionType;
    private BigDecimal refundAmount;
    private BigDecimal compensationAmount;
    private Long resolvedByUserId;
    private String buyerName;
    private String supplierName;
    private String product;
    private String amount;
    private BigDecimal totalPaid;
    private BigDecimal orderQuantity;
    private String orderItemUnit;
    private BigDecimal unitPrice;
    private BigDecimal shippingFee;
    private String orderStatus;
    private String shipmentStatus;
    private String paymentStatus;
    private Boolean canRefund;
    private String createdByName;
    private String assignedToName;
    private String createdAt;
    private String resolvedAt;
    private String incidentType;
    private String incidentStatus;
    private String incidentStatusLabel;
    private String buyerEvidenceUrls;
    private String supplierResponse;
    private String supplierEvidenceUrls;
    private String proposedResolution;
    private String resolutionType;
}
