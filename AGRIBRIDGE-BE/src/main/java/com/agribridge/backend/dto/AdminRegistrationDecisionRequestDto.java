package com.agribridge.backend.dto;

import java.util.List;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class AdminRegistrationDecisionRequestDto {

    private Long adminUserId;
    private List<String> reasonCodes;
    private String note;
    private Boolean sendEmail;
    private Boolean sendNotification;
}
