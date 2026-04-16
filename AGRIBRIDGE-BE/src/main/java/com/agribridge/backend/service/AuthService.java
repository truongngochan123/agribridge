package com.agribridge.backend.service;

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

public interface AuthService {

    AuthResponseDto registerSupplier(CreateSupplierRegistrationDto request);

    AuthResponseDto registerBuyer(CreateBuyerRegistrationDto request);

    AuthResponseDto login(LoginRequestDto request);

    RegistrationOtpResponseDto sendRegistrationOtp(RegistrationOtpSendRequestDto request);

    RegistrationOtpResponseDto verifyRegistrationOtp(RegistrationOtpVerifyRequestDto request);

    RegistrationAvailabilityResponseDto checkRegistrationAvailability(RegistrationAvailabilityRequestDto request);

    TaxCodeLookupResponseDto lookupCompanyByTaxCode(TaxCodeLookupRequestDto request);

    AuthResponseDto checkRegistrationStatusByEmail(String email);

    AuthResponseDto approveCompanyVerification(Long companyId, Long verifiedByUserId);
}
