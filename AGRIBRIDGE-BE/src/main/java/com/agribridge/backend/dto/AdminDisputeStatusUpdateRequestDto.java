package com.agribridge.backend.dto;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class AdminDisputeStatusUpdateRequestDto {

    private Long assignedToUserId;
    private String status;
    private String resolution;
}
