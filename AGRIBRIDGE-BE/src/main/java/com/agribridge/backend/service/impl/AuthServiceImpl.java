package com.agribridge.backend.service.impl;

import com.agribridge.backend.dto.AuthResponseDto;
import com.agribridge.backend.dto.CreateBuyerRegistrationDto;
import com.agribridge.backend.dto.CreateSupplierRegistrationDto;
import com.agribridge.backend.dto.ForgotPasswordResponseDto;
import com.agribridge.backend.dto.ForgotPasswordSendRequestDto;
import com.agribridge.backend.dto.ForgotPasswordVerifyRequestDto;
import com.agribridge.backend.dto.LoginRequestDto;
import com.agribridge.backend.dto.RegistrationAvailabilityRequestDto;
import com.agribridge.backend.dto.RegistrationAvailabilityResponseDto;
import com.agribridge.backend.dto.RegistrationOtpResponseDto;
import com.agribridge.backend.dto.RegistrationOtpSendRequestDto;
import com.agribridge.backend.dto.RegistrationOtpVerifyRequestDto;
import com.agribridge.backend.dto.ResetPasswordRequestDto;
import com.agribridge.backend.dto.TaxCodeLookupRequestDto;
import com.agribridge.backend.dto.TaxCodeLookupResponseDto;
import com.agribridge.backend.entity.CompanyEntity;
import com.agribridge.backend.entity.CompanyImageEntity;
import com.agribridge.backend.entity.UserEntity;
import com.agribridge.backend.entity.enums.BusinessTypeEnum;
import com.agribridge.backend.entity.enums.CompanyTypeEnum;
import com.agribridge.backend.entity.enums.ImageTypeEnum;
import com.agribridge.backend.entity.enums.UserRoleEnum;
import com.agribridge.backend.entity.enums.UserStatusEnum;
import com.agribridge.backend.entity.enums.VerificationStatusEnum;
import com.agribridge.backend.repository.CompanyImageRepository;
import com.agribridge.backend.repository.CompanyRepository;
import com.agribridge.backend.repository.UserRepository;
import com.agribridge.backend.service.AuthService;
import com.agribridge.backend.service.AuthTokenService;
import com.agribridge.backend.service.OutboundEmailService;
import com.agribridge.backend.service.SupplierVerificationScoringService;
import com.agribridge.backend.service.TaxCodeLookupService;
import java.math.BigDecimal;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ThreadLocalRandom;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.lang.NonNull;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
@Slf4j
public class AuthServiceImpl implements AuthService {

    private static final String STATUS_SUCCESS = "SUCCESS";
    private static final String STATUS_PENDING = "PENDING_VERIFICATION";
    private static final String STATUS_NEED_MORE_INFO = "NEED_MORE_INFO";
    private static final String STATUS_REJECTED = "REJECTED";
    private static final int MAX_IMAGE_URL_LENGTH = 240;
    private static final long OTP_TTL_MINUTES = 10;
    private static final long PASSWORD_RESET_RESEND_SECONDS = 60;
    private static final int AUTO_APPROVE_THRESHOLD = 80;
    private static final BigDecimal DEFAULT_CREDIT_LIMIT = BigDecimal.ZERO;
    private final CompanyRepository companyRepository;
    private final UserRepository userRepository;
    private final CompanyImageRepository companyImageRepository;
    private final JdbcTemplate jdbcTemplate;
    private final OutboundEmailService outboundEmailService;
    private final AuthTokenService authTokenService;
    private final TaxCodeLookupService taxCodeLookupService;
    private final SupplierVerificationScoringService verificationScoringService;

    @Value("${app.mail.enabled:false}")
    private boolean mailEnabled;

    private final BCryptPasswordEncoder passwordEncoder = new BCryptPasswordEncoder();
    private final Map<String, PendingRegistrationOtp> registrationOtpStore = new ConcurrentHashMap<>();
    private final Map<String, PendingPasswordResetOtp> passwordResetOtpStore = new ConcurrentHashMap<>();

    @Override
    @Transactional
    public AuthResponseDto registerSupplier(CreateSupplierRegistrationDto request) {
        log.info("Registering supplier loginEmail={} loginPhone={}", request.getLoginEmail(), request.getLoginPhone());
        String normalizedPhone = normalizePhone(request.getLoginPhone());
        String normalizedLoginEmail = normalizeRequiredEmail(request.getLoginEmail());
        String normalizedTaxCode = normalizeDigitsOnly(request.getTaxCode());
        String normalizedCitizenId = normalizeDigitsOnly(request.getCitizenId());

        validateVerifiedRegistrationEmail(normalizedLoginEmail);
        validateUniqueLoginPhone(normalizedPhone);
        validateUniqueEmail(normalizedLoginEmail);
        validateUniqueTaxCode(normalizedTaxCode);
        validateUniqueCitizenId(normalizedCitizenId);
        validatePassword(request.getPassword());
        validateAddress(request.getProvince(), request.getWard(), request.getAddress());
        validateSupplierSubmission(request);

        String companyPhone = resolveCompanyPhone(request.getCompanyPhone(), normalizedPhone);
        String companyEmail = resolveCompanyEmail(request.getCompanyEmail(), normalizedLoginEmail);

        // Resolve document URLs: first doc = identity, second = business license
        String identityDocUrl = resolveDocumentUrl(request.getDocumentUrls(), 0);
        String businessLicenseUrl = resolveDocumentUrl(request.getDocumentUrls(), 1);

        // ── Auto-verification scoring ──────────────────────────────────────────────
        SupplierVerificationScoringService.ScoringResult scoring = verificationScoringService.score(
                normalizedTaxCode,
                request.getCompanyName(),
                request.getProvince(),
                normalizedLoginEmail,
                normalizedPhone,
                identityDocUrl);
        log.info("Verification scoring companyName={} score={} reason={}",
                request.getCompanyName(), scoring.score(), scoring.reason());

        boolean autoApproved = scoring.score() >= AUTO_APPROVE_THRESHOLD;
        VerificationStatusEnum verificationStatus = autoApproved
                ? VerificationStatusEnum.AUTO_APPROVED
                : VerificationStatusEnum.PENDING_REVIEW;
        boolean verifiedStatus = autoApproved;
        String trustLevel = autoApproved ? "MEDIUM" : "SUPPLIER_PENDING";

        CompanyEntity company = Objects
                .requireNonNull(companyRepository.save(Objects.requireNonNull(CompanyEntity.builder()
                        .name(resolveCompanyName(request.getCompanyName(), request.getFullName()))
                        .companyType(CompanyTypeEnum.SUPPLIER)
                        .businessType(BusinessTypeEnum.BUSINESS)
                        .ownerName(resolveOwnerName(request.getOwnerName(), request.getFullName()))
                        .citizenId(normalizedCitizenId)
                        .taxCode(normalizedTaxCode)
                        .phone(companyPhone)
                        .email(companyEmail)
                        .address(resolveAddress(request.getAddress()))
                        .province(resolveProvince(request.getProvince()))
                        .district(resolveDistrict(request.getDistrict()))
                        .ward(resolveWard(request.getWard()))
                        .description(request.getDescription())
                        .verifiedStatus(verifiedStatus)
                        .verificationStatus(verificationStatus)
                        .verificationScore(scoring.score())
                        .verificationReason(scoring.reason())
                        .taxLookupStatus(scoring.taxLookupStatus())
                        .taxLookupProvider(scoring.taxLookupProvider())
                        .identityDocumentUrl(sanitizeImageUrl(identityDocUrl))
                        .businessLicenseUrl(sanitizeImageUrl(businessLicenseUrl))
                        .trustLevel(trustLevel)
                        .creditLimit(DEFAULT_CREDIT_LIMIT)
                        .verifiedAt(autoApproved ? LocalDateTime.now() : null)
                        .createdAt(LocalDateTime.now())
                        .build())));

        saveCompanyLogo(company.getId(), request.getLogoUrl());
        saveSupplierDocuments(company.getId(), request.getDocumentUrls());

        UserEntity user = Objects.requireNonNull(userRepository.save(Objects.requireNonNull(UserEntity.builder()
                .companyId(company.getId())
                .fullName(request.getFullName())
                .phone(normalizedPhone)
                .email(normalizedLoginEmail)
                .passwordHash(passwordEncoder.encode(request.getPassword()))
                .role(UserRoleEnum.OWNER)
                .status(UserStatusEnum.ACTIVE)
                .createdAt(LocalDateTime.now())
                .build())));

        clearRegistrationOtpState(normalizedLoginEmail);

        AuthTokenService.TokenIssue token = authTokenService.issueToken(user.getId());

        if (autoApproved) {
            log.info("Supplier AUTO_APPROVED companyId={} userId={} score={}",
                    company.getId(), user.getId(), scoring.score());
            return AuthResponseDto.builder()
                    .status(STATUS_SUCCESS)
                    .message("Hồ sơ của bạn đã được duyệt tự động.")
                    .redirectPath("/onboarding/verification/approved")
                    .userId(user.getId())
                    .companyId(company.getId())
                    .companyType(CompanyTypeEnum.SUPPLIER.name().toLowerCase())
                    .verificationStatus(VerificationStatusEnum.AUTO_APPROVED.name())
                    .verificationScore(scoring.score())
                    .trustLevel(company.getTrustLevel())
                    .creditLimit(company.getCreditLimit())
                    .canUseCredit(false)
                    .accessToken(token.accessToken())
                    .tokenExpiresAt(token.expiresAt())
                    .build();
        }

        log.info("Supplier PENDING_REVIEW companyId={} userId={} score={}",
                company.getId(), user.getId(), scoring.score());
        return AuthResponseDto.builder()
                .status(STATUS_PENDING)
                .message("Hồ sơ của bạn đang chờ admin duyệt. Bạn có thể đăng nhập nhưng một số chức năng sẽ bị giới hạn.")
                .redirectPath("/onboarding/verification/pending")
                .userId(user.getId())
                .companyId(company.getId())
                .companyType(CompanyTypeEnum.SUPPLIER.name().toLowerCase())
                .verificationStatus(VerificationStatusEnum.PENDING_REVIEW.name())
                .verificationScore(scoring.score())
                .trustLevel(company.getTrustLevel())
                .creditLimit(company.getCreditLimit())
                .canUseCredit(false)
                .accessToken(token.accessToken())
                .tokenExpiresAt(token.expiresAt())
                .build();
    }

    @Override
    @Transactional
    public AuthResponseDto registerBuyer(CreateBuyerRegistrationDto request) {
        log.info("Registering buyer loginEmail={} loginPhone={}", request.getLoginEmail(), request.getLoginPhone());
        String normalizedPhone = normalizePhone(request.getLoginPhone());
        String normalizedLoginEmail = normalizeRequiredEmail(request.getLoginEmail());
        String normalizedTaxCode = normalizeDigitsOnly(request.getTaxCode());

        validateVerifiedRegistrationEmail(normalizedLoginEmail);
        validateUniqueLoginPhone(normalizedPhone);
        validateUniqueEmail(normalizedLoginEmail);
        validatePassword(request.getPassword());
        validateAddress(request.getProvince(), request.getWard(), request.getAddress());

        BusinessTypeEnum businessType = deriveBuyerBusinessType(normalizedTaxCode);
        if (BusinessTypeEnum.BUSINESS.equals(businessType)) {
            validateTaxCode(normalizedTaxCode);
            validateUniqueTaxCode(normalizedTaxCode);
        } else {
            normalizedTaxCode = null;
        }

        String companyPhone = resolveCompanyPhone(request.getCompanyPhone(), normalizedPhone);
        String companyEmail = resolveCompanyEmail(request.getCompanyEmail(), normalizedLoginEmail);

        CompanyEntity company = Objects
                .requireNonNull(companyRepository.save(Objects.requireNonNull(CompanyEntity.builder()
                        .name(resolveCompanyName(request.getCompanyName(), request.getFullName()))
                        .companyType(CompanyTypeEnum.BUYER)
                        .businessType(businessType)
                        .ownerName(resolveOwnerName(request.getOwnerName(), request.getFullName()))
                        .citizenId(normalizeDigitsOnly(request.getCitizenId()))
                        .taxCode(normalizedTaxCode)
                        .phone(companyPhone)
                        .email(companyEmail)
                        .address(resolveAddress(request.getAddress()))
                        .province(resolveProvince(request.getProvince()))
                        .district(resolveDistrict(request.getDistrict()))
                        .ward(resolveWard(request.getWard()))
                        .description(request.getDescription())
                        .verifiedStatus(true)
                        .verificationStatus(VerificationStatusEnum.APPROVED)
                        .trustLevel(BusinessTypeEnum.BUSINESS.equals(businessType) ? "MEDIUM" : "LOW")
                        .creditLimit(DEFAULT_CREDIT_LIMIT)
                        .verifiedAt(LocalDateTime.now())
                        .createdAt(LocalDateTime.now())
                        .build())));

        saveCompanyLogo(company.getId(), request.getLogoUrl());

        UserEntity user = Objects.requireNonNull(userRepository.save(Objects.requireNonNull(UserEntity.builder()
                .companyId(company.getId())
                .fullName(request.getFullName())
                .phone(normalizedPhone)
                .email(normalizedLoginEmail)
                .passwordHash(passwordEncoder.encode(request.getPassword()))
                .role(UserRoleEnum.OWNER)
                .status(UserStatusEnum.ACTIVE)
                .createdAt(LocalDateTime.now())
                .build())));

        AuthTokenService.TokenIssue token = authTokenService.issueToken(user.getId());
        return AuthResponseDto.builder()
                .status(STATUS_SUCCESS)
                .message("Buyer registration completed.")
                .redirectPath("/buyer/overview")
                .userId(user.getId())
                .companyId(company.getId())
                .companyType(CompanyTypeEnum.BUYER.name().toLowerCase())
                .trustLevel(company.getTrustLevel())
                .creditLimit(company.getCreditLimit())
                .canUseCredit(canUseCredit(company))
                .accessToken(token.accessToken())
                .tokenExpiresAt(token.expiresAt())
                .build();
    }

    @Override
    @Transactional
    public AuthResponseDto login(LoginRequestDto request) {
        log.info("Authenticating user email={}", request.getEmail());
        String normalizedEmail = normalizeRequiredEmail(request.getEmail());
        AuthUserSnapshot user = findAuthUserByEmail(normalizedEmail)
                .orElseThrow(() -> new IllegalArgumentException("Invalid email or password"));

        if (!passwordEncoder.matches(request.getPassword(), user.passwordHash())) {
            throw new IllegalArgumentException("Invalid email or password");
        }
        if (user.status() == UserStatusEnum.PENDING_INVITE) {
            userRepository.findById(user.userId()).ifPresent(invitedUser -> {
                invitedUser.setStatus(UserStatusEnum.ACTIVE);
                userRepository.save(invitedUser);
            });
            log.info("Activated invited employee userId={} on first successful login", user.userId());
        } else if (user.status() != null && user.status() != UserStatusEnum.ACTIVE) {
            throw new IllegalArgumentException("Tài khoản đã bị khóa");
        }
        AuthCompanySnapshot company = loadAuthCompany(user.companyId())
                .orElseThrow(() -> new IllegalArgumentException("Company not found for user"));
        AuthResponseDto response = buildAuthResponse(company, user.userId(), true);
        log.info("Authenticated user successfully email={} userId={} companyId={} status={}",
                normalizedEmail, user.userId(), user.companyId(), response.getStatus());
        return response;
    }

    @Override
    public ForgotPasswordResponseDto sendForgotPasswordOtp(ForgotPasswordSendRequestDto request) {
        String normalizedEmail = normalizeRequiredEmail(request.getEmail());
        log.info("Sending password reset OTP email={}", normalizedEmail);

        if (userRepository.findByEmailIgnoreCase(normalizedEmail).isEmpty()) {
            throw new IllegalArgumentException("Email không tồn tại trong hệ thống.");
        }

        PendingPasswordResetOtp currentOtp = passwordResetOtpStore.get(normalizedEmail);
        if (currentOtp != null && currentOtp.resendBlocked()) {
            long waitSeconds = Math.max(1, ChronoUnit.SECONDS.between(LocalDateTime.now(), currentOtp.resendAvailableAt()));
            throw new IllegalArgumentException("Vui lòng chờ " + waitSeconds + " giây trước khi gửi lại mã.");
        }

        String otp = String.format("%06d", ThreadLocalRandom.current().nextInt(0, 1_000_000));
        LocalDateTime now = LocalDateTime.now();
        LocalDateTime expiresAt = now.plusMinutes(OTP_TTL_MINUTES);
        LocalDateTime resendAvailableAt = now.plusSeconds(PASSWORD_RESET_RESEND_SECONDS);
        passwordResetOtpStore.put(normalizedEmail,
                new PendingPasswordResetOtp(otp, expiresAt, resendAvailableAt, false));

        sendPasswordResetOtpEmail(normalizedEmail, otp, expiresAt);

        return ForgotPasswordResponseDto.builder()
                .success(true)
                .verified(false)
                .email(normalizedEmail)
                .message(mailEnabled
                        ? "Mã xác thực đã được gửi tới email của bạn."
                        : "Mã xác thực đã được tạo nhưng mail đang tắt. Hãy bật APP_MAIL_ENABLED để gửi email thật.")
                .expiresInSeconds(OTP_TTL_MINUTES * 60)
                .resendAfterSeconds(PASSWORD_RESET_RESEND_SECONDS)
                .build();
    }

    @Override
    public ForgotPasswordResponseDto verifyForgotPasswordOtp(ForgotPasswordVerifyRequestDto request) {
        String normalizedEmail = normalizeRequiredEmail(request.getEmail());
        PendingPasswordResetOtp pendingOtp = passwordResetOtpStore.get(normalizedEmail);

        if (pendingOtp == null || pendingOtp.isExpired()) {
            passwordResetOtpStore.remove(normalizedEmail);
            throw new IllegalArgumentException("Mã OTP đã hết hạn hoặc chưa được gửi.");
        }

        if (!Objects.equals(pendingOtp.code(), safeTrim(request.getOtp()))) {
            throw new IllegalArgumentException("Mã OTP không chính xác.");
        }

        PendingPasswordResetOtp verifiedOtp = pendingOtp.markVerified();
        passwordResetOtpStore.put(normalizedEmail, verifiedOtp);

        return ForgotPasswordResponseDto.builder()
                .success(true)
                .verified(true)
                .email(normalizedEmail)
                .message("Mã xác thực hợp lệ. Bạn có thể đặt mật khẩu mới.")
                .expiresInSeconds(Math.max(0, ChronoUnit.SECONDS.between(LocalDateTime.now(), pendingOtp.expiresAt())))
                .resendAfterSeconds(Math.max(0,
                        ChronoUnit.SECONDS.between(LocalDateTime.now(), pendingOtp.resendAvailableAt())))
                .build();
    }

    @Override
    @Transactional
    public ForgotPasswordResponseDto resetPassword(ResetPasswordRequestDto request) {
        String normalizedEmail = normalizeRequiredEmail(request.getEmail());
        PendingPasswordResetOtp pendingOtp = passwordResetOtpStore.get(normalizedEmail);

        if (pendingOtp == null || pendingOtp.isExpired()) {
            passwordResetOtpStore.remove(normalizedEmail);
            throw new IllegalArgumentException("Phiên đặt lại mật khẩu đã hết hạn.");
        }
        if (!pendingOtp.verified() || !Objects.equals(pendingOtp.code(), safeTrim(request.getOtp()))) {
            throw new IllegalArgumentException("Mã xác thực không hợp lệ.");
        }

        validateStrongPassword(request.getNewPassword());
        UserEntity user = userRepository.findByEmailIgnoreCase(normalizedEmail)
                .orElseThrow(() -> new IllegalArgumentException("Email không tồn tại trong hệ thống."));
        user.setPasswordHash(passwordEncoder.encode(request.getNewPassword()));
        userRepository.save(user);
        passwordResetOtpStore.remove(normalizedEmail);

        log.info("Password reset completed email={} userId={}", normalizedEmail, user.getId());
        return ForgotPasswordResponseDto.builder()
                .success(true)
                .verified(true)
                .email(normalizedEmail)
                .message("Mật khẩu đã được cập nhật thành công.")
                .expiresInSeconds(0)
                .resendAfterSeconds(0)
                .build();
    }

    @Override
    public RegistrationOtpResponseDto sendRegistrationOtp(RegistrationOtpSendRequestDto request) {
        log.info("Sending registration OTP email={}", request.getEmail());
        String normalizedEmail = normalizeRequiredEmail(request.getEmail());
        validateUniqueEmail(normalizedEmail);

        String otp = String.format("%06d", ThreadLocalRandom.current().nextInt(0, 1_000_000));
        LocalDateTime expiresAt = LocalDateTime.now().plusMinutes(OTP_TTL_MINUTES);
        registrationOtpStore.put(normalizedEmail, new PendingRegistrationOtp(otp, expiresAt, false));
        log.info("Generated registration OTP email={} expiresAt={}", normalizedEmail, expiresAt);
        sendRegistrationOtpEmail(normalizedEmail, otp, expiresAt);

        return RegistrationOtpResponseDto.builder()
                .success(true)
                .verified(false)
                .email(normalizedEmail)
                .message(mailEnabled
                        ? "OTP đã được gửi tới email của bạn."
                        : "OTP đã được tạo nhưng mail đang tắt. Hãy bật APP_MAIL_ENABLED để gửi mail thật.")
                .expiresInSeconds(OTP_TTL_MINUTES * 60)
                .build();
    }

    @Override
    public RegistrationOtpResponseDto verifyRegistrationOtp(RegistrationOtpVerifyRequestDto request) {
        log.info("Verifying registration OTP email={}", request.getEmail());
        String normalizedEmail = normalizeRequiredEmail(request.getEmail());
        PendingRegistrationOtp pendingOtp = registrationOtpStore.get(normalizedEmail);

        if (pendingOtp == null || pendingOtp.isExpired()) {
            throw new IllegalArgumentException("OTP đã hết hạn hoặc chưa được gửi.");
        }

        if (!Objects.equals(pendingOtp.code(), safeTrim(request.getOtp()))) {
            throw new IllegalArgumentException("Mã OTP không chính xác.");
        }

        registrationOtpStore.put(normalizedEmail, pendingOtp.markVerified());
        log.info("Verified registration OTP email={}", normalizedEmail);
        return RegistrationOtpResponseDto.builder()
                .success(true)
                .verified(true)
                .email(normalizedEmail)
                .message("Email đã được xác thực thành công.")
                .expiresInSeconds(Math.max(0, ChronoUnit.SECONDS.between(LocalDateTime.now(), pendingOtp.expiresAt())))
                .build();
    }

    @Override
    @Transactional(readOnly = true)
    public AuthResponseDto checkRegistrationStatusByEmail(String email) {
        log.info("Checking registration status by email={}", email);
        String normalizedEmail = normalizeRequiredEmail(email);
        AuthUserSnapshot user = findAuthUserByEmail(normalizedEmail)
                .orElseThrow(() -> new IllegalArgumentException("User not found for email: " + normalizedEmail));
        AuthCompanySnapshot company = loadAuthCompany(user.companyId())
                .orElseThrow(() -> new IllegalArgumentException("Company not found for user"));
        AuthResponseDto response = buildAuthResponse(company, user.userId(), false);
        log.info("Checked registration status email={} userId={} status={}", normalizedEmail, user.userId(),
                response.getStatus());
        return response;
    }

    private AuthResponseDto buildAuthResponse(AuthCompanySnapshot company, Long userId, boolean issueToken) {
        VerificationStatusEnum verificationStatus = company.verificationStatus() == null
                ? VerificationStatusEnum.PENDING_REVIEW
                : company.verificationStatus();
        AuthTokenService.TokenIssue token = issueToken ? authTokenService.issueToken(userId) : null;

        // PENDING or PENDING_REVIEW → waiting for admin
        if (verificationStatus == VerificationStatusEnum.PENDING
                || verificationStatus == VerificationStatusEnum.PENDING_REVIEW
                || verificationStatus == VerificationStatusEnum.DRAFT) {
            return AuthResponseDto.builder()
                    .status(STATUS_PENDING)
                    .message("Hồ sơ của bạn đang chờ admin duyệt. Bạn có thể đăng nhập nhưng một số chức năng sẽ bị giới hạn.")
                    .redirectPath("/onboarding/verification/pending")
                    .userId(userId)
                    .companyId(company.companyId())
                    .companyType(toCompanyTypeValue(company.companyType()))
                    .userStatus(UserStatusEnum.ACTIVE.name())
                    .verificationStatus(verificationStatus.name())
                    .verificationNote(company.verificationNote())
                    .trustLevel(company.trustLevel())
                    .creditLimit(company.creditLimit())
                    .canUseCredit(false)
                    .accessToken(token == null ? null : token.accessToken())
                    .tokenExpiresAt(token == null ? null : token.expiresAt())
                    .build();
        }

        // NEED_MORE_INFO or NEEDS_MORE_INFO → resubmit
        if (verificationStatus == VerificationStatusEnum.NEED_MORE_INFO
                || verificationStatus == VerificationStatusEnum.NEEDS_MORE_INFO) {
            return AuthResponseDto.builder()
                    .status(STATUS_NEED_MORE_INFO)
                    .message("Hồ sơ cần bổ sung thêm thông tin trước khi được duyệt.")
                    .redirectPath("/onboarding/registration/complete")
                    .userId(userId)
                    .companyId(company.companyId())
                    .companyType(toCompanyTypeValue(company.companyType()))
                    .userStatus(UserStatusEnum.ACTIVE.name())
                    .verificationStatus(verificationStatus.name())
                    .verificationNote(company.verificationNote())
                    .trustLevel(company.trustLevel())
                    .creditLimit(company.creditLimit())
                    .canUseCredit(false)
                    .accessToken(token == null ? null : token.accessToken())
                    .tokenExpiresAt(token == null ? null : token.expiresAt())
                    .build();
        }

        if (verificationStatus == VerificationStatusEnum.REJECTED) {
            return AuthResponseDto.builder()
                    .status(STATUS_REJECTED)
                    .message("Hồ sơ đã bị từ chối.")
                    .redirectPath("/onboarding/verification/rejected")
                    .userId(userId)
                    .companyId(company.companyId())
                    .companyType(toCompanyTypeValue(company.companyType()))
                    .userStatus(UserStatusEnum.ACTIVE.name())
                    .verificationStatus(verificationStatus.name())
                    .verificationNote(company.verificationNote())
                    .trustLevel(company.trustLevel())
                    .creditLimit(company.creditLimit())
                    .canUseCredit(false)
                    .accessToken(token == null ? null : token.accessToken())
                    .tokenExpiresAt(token == null ? null : token.expiresAt())
                    .build();
        }

        // APPROVED | AUTO_APPROVED | MANUAL_APPROVED → success
        String redirectPath = "SUPPLIER".equalsIgnoreCase(company.companyType())
                ? "/supplier/overview"
                : "/buyer/overview";

        return AuthResponseDto.builder()
                .status(STATUS_SUCCESS)
                .message("Login success")
                .redirectPath(redirectPath)
                .userId(userId)
                .companyId(company.companyId())
                .companyType(toCompanyTypeValue(company.companyType()))
                .userStatus(UserStatusEnum.ACTIVE.name())
                .verificationStatus(verificationStatus.name())
                .verificationNote(company.verificationNote())
                .trustLevel(company.trustLevel())
                .creditLimit(company.creditLimit())
                .canUseCredit(canUseCredit(company))
                .accessToken(token == null ? null : token.accessToken())
                .tokenExpiresAt(token == null ? null : token.expiresAt())
                .build();
    }

    @Override
    @Transactional
    public AuthResponseDto approveCompanyVerification(Long companyId, Long verifiedByUserId) {
        log.info("Approving company verification companyId={} verifiedByUserId={}", companyId, verifiedByUserId);
        CompanyEntity company = Objects.requireNonNull(companyRepository.findById(Objects.requireNonNull(companyId))
                .orElseThrow(() -> new IllegalArgumentException("Company not found: " + companyId)));

        company.setVerifiedStatus(true);
        company.setVerificationStatus(VerificationStatusEnum.APPROVED);
        company.setVerifiedAt(LocalDateTime.now());
        company.setVerifiedByUserId(Objects.requireNonNull(verifiedByUserId));
        if ("SUPPLIER_PENDING".equalsIgnoreCase(company.getTrustLevel())) {
            company.setTrustLevel("MEDIUM");
        }
        companyRepository.save(company);

        String redirectPath = CompanyTypeEnum.SUPPLIER.equals(company.getCompanyType())
                ? "/supplier/overview"
                : "/buyer/overview";

        AuthResponseDto response = AuthResponseDto.builder()
                .status(STATUS_SUCCESS)
                .message("Company verification approved")
                .redirectPath(redirectPath)
                .companyId(company.getId())
                .companyType(company.getCompanyType().name().toLowerCase())
                .userStatus(UserStatusEnum.ACTIVE.name())
                .verificationStatus(VerificationStatusEnum.APPROVED.name())
                .verificationNote(company.getVerificationNote())
                .trustLevel(company.getTrustLevel())
                .creditLimit(company.getCreditLimit())
                .canUseCredit(canUseCredit(company))
                .build();
        log.info("Approved company verification companyId={}", companyId);
        return response;
    }

    @Override
    public RegistrationAvailabilityResponseDto checkRegistrationAvailability(
            RegistrationAvailabilityRequestDto request) {
        log.info("Checking registration availability email={} phone={} taxCode={}",
                request.getEmail(), request.getPhone(), request.getTaxCode());
        String normalizedPhone = normalizePhoneOptional(request.getPhone());
        String normalizedEmail = normalizeEmail(request.getEmail());
        String normalizedTaxCode = normalizeDigitsOnly(request.getTaxCode());
        String normalizedCitizenId = normalizeDigitsOnly(request.getCitizenId());

        boolean phoneTaken = normalizedPhone != null && userRepository.existsByPhone(normalizedPhone);
        boolean emailTaken = normalizedEmail != null
                && (userRepository.existsByEmailIgnoreCase(normalizedEmail)
                        || companyRepository.existsByEmailIgnoreCase(normalizedEmail));
        boolean taxCodeTaken = normalizedTaxCode != null && companyRepository.existsByTaxCode(normalizedTaxCode);
        boolean citizenIdTaken = normalizedCitizenId != null
                && companyRepository.existsByCitizenId(normalizedCitizenId);

        RegistrationAvailabilityResponseDto response = RegistrationAvailabilityResponseDto.builder()
                .phoneTaken(phoneTaken)
                .emailTaken(emailTaken)
                .taxCodeTaken(taxCodeTaken)
                .citizenIdTaken(citizenIdTaken)
                .normalizedPhone(normalizedPhone)
                .normalizedEmail(normalizedEmail)
                .normalizedTaxCode(normalizedTaxCode)
                .businessTypeHint(normalizedTaxCode == null ? BusinessTypeEnum.INDIVIDUAL.name()
                        : BusinessTypeEnum.BUSINESS.name())
                .taxCodeValid(normalizedTaxCode == null || isValidTaxCode(normalizedTaxCode))
                .citizenIdValid(normalizedCitizenId == null || isValidCitizenId(normalizedCitizenId))
                .build();
        log.info("Checked registration availability emailTaken={} phoneTaken={} taxCodeTaken={} citizenIdTaken={}",
                emailTaken, phoneTaken, taxCodeTaken, citizenIdTaken);
        return response;
    }

    @Override
    public TaxCodeLookupResponseDto lookupCompanyByTaxCode(TaxCodeLookupRequestDto request) {
        log.info("Looking up company by tax code={}", request.getTaxCode());
        return taxCodeLookupService.lookupTaxCode(request.getTaxCode());
    }

    private void validateUniqueLoginPhone(String loginPhone) {
        if (userRepository.existsByPhone(loginPhone)) {
            throw new IllegalArgumentException("Phone is already in use: " + loginPhone);
        }
    }

    private String resolveDocumentUrl(java.util.List<String> documentUrls, int index) {
        if (documentUrls == null || index >= documentUrls.size()) {
            return null;
        }
        return sanitizeImageUrl(documentUrls.get(index));
    }

    private void saveCompanyLogo(Long companyId, String logoUrl) {
        String safeImageUrl = sanitizeImageUrl(logoUrl);
        if (safeImageUrl == null) {
            return;
        }

        Objects.requireNonNull(companyImageRepository.save(Objects.requireNonNull(CompanyImageEntity.builder()
                .companyId(Objects.requireNonNull(companyId))
                .imageUrl(Objects.requireNonNull(safeImageUrl))
                .imageType(ImageTypeEnum.LOGO)
                .uploadedAt(LocalDateTime.now())
                .build())));
    }

    private void saveSupplierDocuments(Long companyId, java.util.List<String> documentUrls) {
        if (documentUrls == null || documentUrls.isEmpty()) {
            return;
        }

        documentUrls.stream()
                .map(this::sanitizeImageUrl)
                .filter(url -> url != null && !url.isBlank())
                .forEach(safeUrl -> Objects
                        .requireNonNull(companyImageRepository.save(Objects.requireNonNull(CompanyImageEntity.builder()
                                .companyId(Objects.requireNonNull(companyId))
                                .imageUrl(Objects.requireNonNull(safeUrl))
                                .imageType(ImageTypeEnum.DOCUMENT)
                                .uploadedAt(LocalDateTime.now())
                                .build()))));
    }

    private String sanitizeImageUrl(String rawUrl) {
        if (rawUrl == null) {
            return null;
        }

        String trimmed = rawUrl.trim();
        if (trimmed.isEmpty()) {
            return null;
        }

        if (trimmed.startsWith("data:") || trimmed.startsWith("upload://")) {
            return null;
        }

        if (trimmed.length() > MAX_IMAGE_URL_LENGTH) {
            return trimmed.substring(0, MAX_IMAGE_URL_LENGTH);
        }

        return trimmed;
    }

    private void validateSupplierSubmission(CreateSupplierRegistrationDto request) {
        String normalizedTaxCode = normalizeDigitsOnly(request.getTaxCode());
        String normalizedCitizenId = normalizeDigitsOnly(request.getCitizenId());

        validateTaxCode(normalizedTaxCode);
        validateCitizenId(normalizedCitizenId);

        if (request.getDocumentUrls() == null || request.getDocumentUrls().isEmpty()
                || request.getDocumentUrls().stream().map(this::sanitizeImageUrl).noneMatch(Objects::nonNull)) {
            throw new IllegalArgumentException("Identity document is required for supplier registration");
        }

        request.setTaxCode(normalizedTaxCode);
        request.setCitizenId(normalizedCitizenId);
    }

    private BusinessTypeEnum deriveBuyerBusinessType(String taxCode) {
        return taxCode == null ? BusinessTypeEnum.INDIVIDUAL : BusinessTypeEnum.BUSINESS;
    }

    private String resolveCompanyName(String companyName, String fullName) {
        String trimmed = safeTrim(companyName);
        if (trimmed != null) {
            return trimmed;
        }
        return safeTrim(fullName) + " Company";
    }

    private String resolveOwnerName(String ownerName, String fullName) {
        String trimmed = safeTrim(ownerName);
        if (trimmed != null) {
            return trimmed;
        }
        return safeTrim(fullName);
    }

    private String resolveCompanyPhone(String companyPhone, String loginPhone) {
        String normalizedCompanyPhone = normalizePhoneOptional(companyPhone);
        if (normalizedCompanyPhone != null) {
            return normalizedCompanyPhone;
        }
        return loginPhone;
    }

    private String resolveCompanyEmail(String companyEmail, String loginEmail) {
        String normalizedCompanyEmail = normalizeEmail(companyEmail);
        if (normalizedCompanyEmail != null) {
            return normalizedCompanyEmail;
        }
        return loginEmail;
    }

    private String resolveAddress(String address) {
        String trimmed = safeTrim(address);
        if (trimmed != null) {
            return trimmed;
        }
        return "N/A";
    }

    private String resolveProvince(String province) {
        String trimmed = safeTrim(province);
        if (trimmed != null) {
            return trimmed;
        }
        return "Unknown";
    }

    private String resolveDistrict(String district) {
        return safeTrim(district);
    }

    private String resolveWard(String ward) {
        String trimmed = safeTrim(ward);
        if (trimmed != null) {
            return trimmed;
        }
        return "Unknown";
    }

    private String normalizePhone(String rawPhone) {
        String normalized = normalizePhoneOptional(rawPhone);
        if (normalized == null) {
            throw new IllegalArgumentException("Phone is required");
        }
        return normalized;
    }

    private String normalizePhoneOptional(String rawPhone) {
        String trimmed = safeTrim(rawPhone);
        if (trimmed == null) {
            return null;
        }

        String digits = trimmed.replaceAll("[^0-9+]", "");
        if (digits.startsWith("+84")) {
            String body = digits.substring(3);
            if (!body.matches("\\d{9,10}")) {
                throw new IllegalArgumentException("Phone format is invalid");
            }
            return "+84" + body;
        }

        if (digits.startsWith("84")) {
            String body = digits.substring(2);
            if (!body.matches("\\d{9,10}")) {
                throw new IllegalArgumentException("Phone format is invalid");
            }
            return "+84" + body;
        }

        if (digits.startsWith("0") && digits.length() >= 10) {
            String body = digits.substring(1);
            if (!body.matches("\\d{9,10}")) {
                throw new IllegalArgumentException("Phone format is invalid");
            }
            return "+84" + body;
        }

        throw new IllegalArgumentException("Phone format is invalid");
    }

    private String normalizeEmail(String rawEmail) {
        String trimmed = safeTrim(rawEmail);
        if (trimmed == null) {
            return null;
        }
        return trimmed.toLowerCase(Locale.ROOT);
    }

    private String normalizeRequiredEmail(String rawEmail) {
        String normalized = normalizeEmail(rawEmail);
        if (normalized == null) {
            throw new IllegalArgumentException("Email is required");
        }
        return normalized;
    }

    private Optional<AuthUserSnapshot> findAuthUserByEmail(String normalizedEmail) {
        return jdbcTemplate.query(
                """
                        SELECT TOP 1 id, company_id, phone, email, password_hash, status
                        FROM users
                        WHERE LOWER(email) = ?
                        ORDER BY id DESC
                        """,
                AUTH_USER_ROW_MAPPER,
                normalizedEmail)
                .stream()
                .findFirst();
    }

    private Optional<AuthCompanySnapshot> loadAuthCompany(Long companyId) {
        return jdbcTemplate.query(
                """
                        SELECT TOP 1 id, company_type, verified_status, verification_status, verification_note, trust_level, credit_limit
                        FROM companies
                        WHERE id = ?
                        """,
                AUTH_COMPANY_ROW_MAPPER,
                companyId)
                .stream()
                .findFirst();
    }

    private String normalizeDigitsOnly(String value) {
        String trimmed = safeTrim(value);
        if (trimmed == null) {
            return null;
        }
        return trimmed.replaceAll("\\D", "");
    }

    private void validateUniqueEmail(String email) {
        if (email == null) {
            return;
        }
        if (userRepository.existsByEmailIgnoreCase(email) || companyRepository.existsByEmailIgnoreCase(email)) {
            throw new IllegalArgumentException("Email is already in use: " + email);
        }
    }

    private void validateVerifiedRegistrationEmail(String email) {
        PendingRegistrationOtp pendingOtp = registrationOtpStore.get(email);
        if (pendingOtp == null || pendingOtp.isExpired() || !pendingOtp.verified()) {
            throw new IllegalArgumentException("Email chưa được xác thực OTP.");
        }
    }

    private void clearRegistrationOtpState(String email) {
        if (email != null) {
            registrationOtpStore.remove(email);
        }
    }

    private void sendRegistrationOtpEmail(String email, String otp, LocalDateTime expiresAt) {
        if (!mailEnabled) {
            log.info("Registration OTP for {} is {} (mail disabled)", email, otp);
            return;
        }

        try {
            outboundEmailService.sendTextEmail(
                    email,
                    "Ma OTP dang ky AgriBridge",
                    """
                            Xin chao,

                            Ma OTP dang ky tai khoan AgriBridge cua ban la: %s

                            Ma co hieu luc trong %d phut. Vui long khong chia se ma nay cho nguoi khac.

                            AgriBridge
                            """
                            .formatted(otp, OTP_TTL_MINUTES));
            log.info("Sent registration OTP email={} expiresAt={}", email, expiresAt);
        } catch (Exception exception) {
            log.error("Failed to send registration OTP email={}", email, exception);
            throw new IllegalStateException("Khong the gui email OTP qua Resend. Vui long kiem tra lai cau hinh.", exception);
        }
    }

    private void sendPasswordResetOtpEmail(String email, String otp, LocalDateTime expiresAt) {
        if (!mailEnabled) {
            log.info("Password reset OTP for {} is {} (mail disabled)", email, otp);
            return;
        }

        try {
            outboundEmailService.sendTextEmail(
                    email,
                    "Ma xac thuc dat lai mat khau AgriBridge",
                    """
                            Xin chao,

                            Ma xac thuc dat lai mat khau AgriBridge cua ban la: %s

                            Ma co hieu luc trong %d phut. Vui long khong chia se ma nay cho nguoi khac.
                            Neu ban khong yeu cau dat lai mat khau, hay bo qua email nay.

                            AgriBridge
                            """
                            .formatted(otp, OTP_TTL_MINUTES));
            log.info("Sent password reset OTP email={} expiresAt={}", email, expiresAt);
        } catch (Exception exception) {
            log.error("Failed to send password reset OTP email={}", email, exception);
            throw new IllegalStateException("Khong the gui email OTP qua Resend. Vui long kiem tra lai cau hinh.", exception);
        }
    }

    private void validateUniqueTaxCode(String taxCode) {
        if (taxCode == null) {
            return;
        }
        if (companyRepository.existsByTaxCode(taxCode)) {
            throw new IllegalArgumentException("Tax code is already in use: " + taxCode);
        }
    }

    private void validateUniqueCitizenId(String citizenId) {
        if (citizenId == null) {
            return;
        }
        if (companyRepository.existsByCitizenId(citizenId)) {
            throw new IllegalArgumentException("Citizen ID is already linked to another company");
        }
    }

    private void validatePassword(String rawPassword) {
        if (rawPassword == null || rawPassword.trim().length() < 6) {
            throw new IllegalArgumentException("Password must be at least 6 characters");
        }
    }

    private void validateStrongPassword(String rawPassword) {
        String value = safeTrim(rawPassword);
        if (value == null || value.length() < 8) {
            throw new IllegalArgumentException("Mật khẩu phải có ít nhất 8 ký tự.");
        }
        if (!value.matches(".*[A-Z].*")) {
            throw new IllegalArgumentException("Mật khẩu phải có ít nhất một chữ hoa.");
        }
        if (!value.matches(".*[a-z].*")) {
            throw new IllegalArgumentException("Mật khẩu phải có ít nhất một chữ thường.");
        }
        if (!value.matches(".*\\d.*")) {
            throw new IllegalArgumentException("Mật khẩu phải có ít nhất một chữ số.");
        }
        if (!value.matches(".*[^A-Za-z0-9].*")) {
            throw new IllegalArgumentException("Mật khẩu phải có ít nhất một ký tự đặc biệt.");
        }
    }

    private void validateTaxCode(String taxCode) {
        if (!isValidTaxCode(taxCode)) {
            throw new IllegalArgumentException("Tax code must be exactly 10 digits");
        }
    }

    private void validateCitizenId(String citizenId) {
        if (!isValidCitizenId(citizenId)) {
            throw new IllegalArgumentException("Citizen ID must be exactly 12 digits");
        }
    }

    private boolean isValidTaxCode(String taxCode) {
        return taxCode != null && taxCode.matches("\\d{10}");
    }

    private boolean isValidCitizenId(String citizenId) {
        return citizenId != null && citizenId.matches("\\d{12}");
    }

    private void validateAddress(String province, String ward, String address) {
        if (safeTrim(province) == null || safeTrim(ward) == null || safeTrim(address) == null) {
            throw new IllegalArgumentException("Province, ward and address are required");
        }
    }

    private String safeTrim(String input) {
        if (input == null) {
            return null;
        }
        String trimmed = input.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private record PendingRegistrationOtp(String code, LocalDateTime expiresAt, boolean verified) {
        boolean isExpired() {
            return expiresAt == null || LocalDateTime.now().isAfter(expiresAt);
        }

        PendingRegistrationOtp markVerified() {
            return new PendingRegistrationOtp(code, expiresAt, true);
        }
    }

    private record PendingPasswordResetOtp(
            String code,
            LocalDateTime expiresAt,
            LocalDateTime resendAvailableAt,
            boolean verified) {
        boolean isExpired() {
            return expiresAt == null || LocalDateTime.now().isAfter(expiresAt);
        }

        boolean resendBlocked() {
            return resendAvailableAt != null && LocalDateTime.now().isBefore(resendAvailableAt);
        }

        PendingPasswordResetOtp markVerified() {
            return new PendingPasswordResetOtp(code, expiresAt, resendAvailableAt, true);
        }
    }

    private boolean canUseCredit(CompanyEntity company) {
        if (company == null) {
            return false;
        }
        if (!Boolean.TRUE.equals(company.getVerifiedStatus())) {
            return false;
        }
        if (company.getCreditLimit() == null || company.getCreditLimit().compareTo(BigDecimal.ZERO) <= 0) {
            return false;
        }
        String trustLevel = safeTrim(company.getTrustLevel());
        return "MEDIUM".equalsIgnoreCase(trustLevel) || "HIGH".equalsIgnoreCase(trustLevel);
    }

    private boolean canUseCredit(AuthCompanySnapshot company) {
        if (company == null) {
            return false;
        }
        boolean approved = company.verificationStatus() == VerificationStatusEnum.APPROVED
                || company.verificationStatus() == VerificationStatusEnum.AUTO_APPROVED
                || company.verificationStatus() == VerificationStatusEnum.MANUAL_APPROVED;
        if (!approved) {
            return false;
        }
        if (company.creditLimit() == null || company.creditLimit().compareTo(BigDecimal.ZERO) <= 0) {
            return false;
        }
        String trustLevel = safeTrim(company.trustLevel());
        return "MEDIUM".equalsIgnoreCase(trustLevel) || "HIGH".equalsIgnoreCase(trustLevel);
    }

    private String toCompanyTypeValue(String companyType) {
        return companyType == null ? null : companyType.toLowerCase(Locale.ROOT);
    }

    private static final @NonNull RowMapper<AuthUserSnapshot> AUTH_USER_ROW_MAPPER = new RowMapper<>() {
        @Override
        public AuthUserSnapshot mapRow(@NonNull ResultSet rs, int rowNum) throws SQLException {
            return new AuthUserSnapshot(
                    rs.getLong("id"),
                    rs.getLong("company_id"),
                    Objects.requireNonNull(rs.getString("phone")),
                    Objects.requireNonNull(rs.getString("password_hash")),
                    parseUserStatus(rs.getString("status")));
        }
    };

    private static final @NonNull RowMapper<AuthCompanySnapshot> AUTH_COMPANY_ROW_MAPPER = new RowMapper<>() {
        @Override
        public AuthCompanySnapshot mapRow(@NonNull ResultSet rs, int rowNum) throws SQLException {
            return new AuthCompanySnapshot(
                    rs.getLong("id"),
                    Objects.requireNonNull(rs.getString("company_type")),
                    rs.getObject("verified_status") == null ? null : rs.getBoolean("verified_status"),
                    parseVerificationStatus(rs.getString("verification_status")),
                    rs.getString("verification_note"),
                    rs.getString("trust_level"),
                    rs.getBigDecimal("credit_limit"));
        }
    };

    private record AuthUserSnapshot(Long userId, Long companyId, String phone, String passwordHash,
            UserStatusEnum status) {
    }

    private record AuthCompanySnapshot(
            Long companyId,
            String companyType,
            Boolean verifiedStatus,
            VerificationStatusEnum verificationStatus,
            String verificationNote,
            String trustLevel,
            BigDecimal creditLimit) {
    }

    private static VerificationStatusEnum parseVerificationStatus(String rawStatus) {
        if (rawStatus == null || rawStatus.isBlank()) {
            return VerificationStatusEnum.PENDING;
        }
        try {
            return VerificationStatusEnum.valueOf(rawStatus.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException exception) {
            return VerificationStatusEnum.PENDING;
        }
    }

    private static UserStatusEnum parseUserStatus(String rawStatus) {
        if (rawStatus == null || rawStatus.isBlank()) {
            return UserStatusEnum.ACTIVE;
        }
        try {
            UserStatusEnum status = UserStatusEnum.valueOf(rawStatus.trim().toUpperCase(Locale.ROOT));
            return status == UserStatusEnum.LOCKED ? UserStatusEnum.BLOCKED : status;
        } catch (IllegalArgumentException exception) {
            return UserStatusEnum.ACTIVE;
        }
    }
}
