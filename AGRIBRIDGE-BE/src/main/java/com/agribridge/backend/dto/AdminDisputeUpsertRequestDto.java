package com.agribridge.backend.dto;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class AdminDisputeUpsertRequestDto {

    private Long orderId;
    private Long batchId;
    private Long createdByUserId;
    private Long assignedToUserId;
    private String status;
    private String severity;
    private String title;
    private String description;
    private String resolution;
}
