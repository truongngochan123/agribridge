package com.agribridge.backend.controller;

import com.agribridge.backend.dto.AdminRegistrationDecisionRequestDto;
import com.agribridge.backend.dto.AdminRegistrationProfileDto;
import com.agribridge.backend.entity.enums.VerificationStatusEnum;
import com.agribridge.backend.service.AdminRegistrationService;
import jakarta.validation.Valid;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/admin/registrations")
@RequiredArgsConstructor
public class AdminRegistrationController {

    private final AdminRegistrationService adminRegistrationService;

    @GetMapping
    public List<AdminRegistrationProfileDto> getRegistrations(
            @RequestParam(required = false) VerificationStatusEnum status,
            @RequestParam(required = false) String search) {
        return adminRegistrationService.getRegistrations(status, search);
    }

    @PostMapping("/{companyId}/approve")
    public AdminRegistrationProfileDto approveRegistration(
            @PathVariable Long companyId,
            @Valid @RequestBody AdminRegistrationDecisionRequestDto request) {
        return adminRegistrationService.approveRegistration(
                companyId,
                request.getAdminUserId(),
                Boolean.TRUE.equals(request.getSendEmail()),
                Boolean.TRUE.equals(request.getSendNotification()));
    }

    @PostMapping("/{companyId}/request-more-info")
    public AdminRegistrationProfileDto requestMoreInfo(
            @PathVariable Long companyId,
            @Valid @RequestBody AdminRegistrationDecisionRequestDto request) {
        return adminRegistrationService.requestMoreInfo(
                companyId,
                request.getAdminUserId(),
                request.getReasonCodes(),
                request.getNote(),
                Boolean.TRUE.equals(request.getSendEmail()),
                Boolean.TRUE.equals(request.getSendNotification()));
    }

    @PostMapping("/{companyId}/reject")
    public AdminRegistrationProfileDto rejectRegistration(
            @PathVariable Long companyId,
            @Valid @RequestBody AdminRegistrationDecisionRequestDto request) {
        return adminRegistrationService.rejectRegistration(
                companyId,
                request.getAdminUserId(),
                request.getReasonCodes(),
                request.getNote(),
                Boolean.TRUE.equals(request.getSendEmail()),
                Boolean.TRUE.equals(request.getSendNotification()));
    }

    @PostMapping("/{companyId}/reopen")
    public AdminRegistrationProfileDto reopenRegistration(
            @PathVariable Long companyId,
            @Valid @RequestBody AdminRegistrationDecisionRequestDto request) {
        return adminRegistrationService.reopenRegistration(
                companyId,
                request.getAdminUserId(),
                request.getNote(),
                Boolean.TRUE.equals(request.getSendEmail()),
                Boolean.TRUE.equals(request.getSendNotification()));
    }
}
