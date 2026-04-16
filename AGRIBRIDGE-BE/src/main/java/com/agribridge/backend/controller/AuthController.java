package com.agribridge.backend.controller;

import com.agribridge.backend.dto.AuthResponseDto;
import com.agribridge.backend.dto.CreateBuyerRegistrationDto;
import com.agribridge.backend.dto.CreateSupplierRegistrationDto;
import com.agribridge.backend.dto.LoginRequestDto;
import com.agribridge.backend.dto.RegistrationAvailabilityRequestDto;
import com.agribridge.backend.dto.RegistrationAvailabilityResponseDto;
import com.agribridge.backend.dto.RegistrationOtpResponseDto;
import com.agribridge.backend.dto.RegistrationOtpSendRequestDto;
import com.agribridge.backend.dto.RegistrationOtpVerifyRequestDto;
import com.agribridge.backend.dto.TaxCodeLookupRequestDto;
import com.agribridge.backend.dto.TaxCodeLookupResponseDto;
import com.agribridge.backend.service.AuthService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;

    @PostMapping("/register/supplier")
    @ResponseStatus(HttpStatus.CREATED)
    public AuthResponseDto registerSupplier(@Valid @RequestBody CreateSupplierRegistrationDto request) {
        return authService.registerSupplier(request);
    }

    @PostMapping("/register/buyer")
    @ResponseStatus(HttpStatus.CREATED)
    public AuthResponseDto registerBuyer(@Valid @RequestBody CreateBuyerRegistrationDto request) {
        return authService.registerBuyer(request);
    }

    @PostMapping("/login")
    public AuthResponseDto login(@Valid @RequestBody LoginRequestDto request) {
        return authService.login(request);
    }

    @PostMapping("/register/otp/send")
    public RegistrationOtpResponseDto sendRegistrationOtp(@Valid @RequestBody RegistrationOtpSendRequestDto request) {
        return authService.sendRegistrationOtp(request);
    }

    @PostMapping("/register/otp/verify")
    public RegistrationOtpResponseDto verifyRegistrationOtp(@Valid @RequestBody RegistrationOtpVerifyRequestDto request) {
        return authService.verifyRegistrationOtp(request);
    }

    @GetMapping("/register/status")
    public AuthResponseDto checkRegistrationStatus(@RequestParam String email) {
        return authService.checkRegistrationStatusByEmail(email);
    }

    @PostMapping("/register/check")
    public RegistrationAvailabilityResponseDto checkRegistrationAvailability(
            @RequestBody RegistrationAvailabilityRequestDto request) {
        return authService.checkRegistrationAvailability(request);
    }

    @PostMapping("/register/tax-code-lookup")
    public TaxCodeLookupResponseDto lookupTaxCode(@Valid @RequestBody TaxCodeLookupRequestDto request) {
        return authService.lookupCompanyByTaxCode(request);
    }
}
