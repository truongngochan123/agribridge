package com.agribridge.backend.controller;

import com.agribridge.backend.dto.AuthResponseDto;
import com.agribridge.backend.dto.RegistrationResubmitProfileDto;
import com.agribridge.backend.dto.RegistrationResubmitRequestDto;
import com.agribridge.backend.service.RegistrationWorkflowService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/registration")
@RequiredArgsConstructor
public class RegistrationController {

    private final RegistrationWorkflowService registrationWorkflowService;

    @GetMapping("/resubmit-draft")
    public RegistrationResubmitProfileDto getResubmissionDraft(
            @RequestParam Long companyId,
            @RequestParam Long userId) {
        return registrationWorkflowService.getResubmissionDraft(companyId, userId);
    }

    @PostMapping("/resubmit")
    public AuthResponseDto resubmitRegistration(@Valid @RequestBody RegistrationResubmitRequestDto request) {
        return registrationWorkflowService.resubmitRegistration(request);
    }
}
