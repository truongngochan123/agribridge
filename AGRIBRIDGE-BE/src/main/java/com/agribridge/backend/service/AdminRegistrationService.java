package com.agribridge.backend.service;

import com.agribridge.backend.dto.AdminRegistrationProfileDto;
import com.agribridge.backend.entity.enums.VerificationStatusEnum;
import java.util.List;

public interface AdminRegistrationService {

    List<AdminRegistrationProfileDto> getRegistrations(VerificationStatusEnum status, String search);

    AdminRegistrationProfileDto approveRegistration(Long companyId, Long adminUserId, boolean sendEmail, boolean sendNotification);

    AdminRegistrationProfileDto requestMoreInfo(
            Long companyId,
            Long adminUserId,
            List<String> reasonCodes,
            String note,
            boolean sendEmail,
            boolean sendNotification);

    AdminRegistrationProfileDto rejectRegistration(
            Long companyId,
            Long adminUserId,
            List<String> reasonCodes,
            String note,
            boolean sendEmail,
            boolean sendNotification);

    AdminRegistrationProfileDto reopenRegistration(
            Long companyId,
            Long adminUserId,
            String note,
            boolean sendEmail,
            boolean sendNotification);
}
