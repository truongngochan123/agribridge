package com.agribridge.backend.service;

import com.agribridge.backend.dto.AdminRegistrationProfileDto;
import com.agribridge.backend.dto.AuthResponseDto;
import com.agribridge.backend.dto.RegistrationResubmitProfileDto;
import com.agribridge.backend.dto.RegistrationResubmitRequestDto;
import com.agribridge.backend.entity.enums.VerificationStatusEnum;

public interface RegistrationWorkflowService {

    RegistrationResubmitProfileDto getResubmissionDraft(Long companyId, Long userId);

    AuthResponseDto resubmitRegistration(RegistrationResubmitRequestDto request);

    void sendRegistrationDecision(
            AdminRegistrationProfileDto profile,
            VerificationStatusEnum status,
            String note,
            boolean sendEmail,
            boolean sendNotification);
}
