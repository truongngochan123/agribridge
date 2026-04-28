package com.agribridge.backend.service.impl;

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
import jakarta.mail.internet.InternetAddress;
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
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.lang.NonNull;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
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
    private static final BigDecimal DEFAULT_CREDIT_LIMIT = BigDecimal.ZERO;
    private static final Map<String, TaxCodeLookupSeed> TAX_CODE_DIRECTORY = Map.of(
            "0312345678",
            new TaxCodeLookupSeed("Cong ty TNHH Nong San Xanh", "TP. Ho Chi Minh", "Quan 1", "12 Nguyen Hue"),
            "0101234567", new TaxCodeLookupSeed("Cong ty Co phan Agri Trade", "Ha Noi", "Cau Giay", "86 Duy Tan"));

    private final CompanyRepository companyRepository;
    private final UserRepository userRepository;
    private final CompanyImageRepository companyImageRepository;
    private final JdbcTemplate jdbcTemplate;
    private final ObjectProvider<JavaMailSender> mailSenderProvider;

    @Value("${app.mail.enabled:false}")
    private boolean mailEnabled;

    @Value("${spring.mail.username:no-reply@agribridge.local}")
    private String mailUsername;

    @Value("${spring.mail.host:}")
    private String mailHost;

    @Value("${spring.mail.port:587}")
    private int mailPort;

    @Value("${app.mail.from-address:}")
    private String mailFromAddress;

    @Value("${app.mail.from-name:AgriBridge}")
    private String mailFromName;

    private final BCryptPasswordEncoder passwordEncoder = new BCryptPasswordEncoder();
    private final Map<String, PendingRegistrationOtp> registrationOtpStore = new ConcurrentHashMap<>();

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
                        .ward(resolveWard(request.getWard()))
                        .description(request.getDescription())
                        .verifiedStatus(false)
                        .verificationStatus(VerificationStatusEnum.PENDING)
                        .trustLevel("SUPPLIER_PENDING")
                        .creditLimit(DEFAULT_CREDIT_LIMIT)
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

        AuthResponseDto response = AuthResponseDto.builder()
                .status(STATUS_PENDING)
                .message("Supplier registration completed. Waiting admin verification.")
                .redirectPath("/waiting-verification")
                .userId(user.getId())
                .companyId(company.getId())
                .companyType(CompanyTypeEnum.SUPPLIER.name().toLowerCase())
                .trustLevel(company.getTrustLevel())
                .creditLimit(company.getCreditLimit())
                .canUseCredit(false)
                .build();
        log.info("Registered supplier successfully companyId={} userId={}", company.getId(), user.getId());
        return response;
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
                .build();
    }

    @Override
    @Transactional(readOnly = true)
    public AuthResponseDto login(LoginRequestDto request) {
        log.info("Authenticating user email={}", request.getEmail());
        String normalizedEmail = normalizeRequiredEmail(request.getEmail());
        AuthUserSnapshot user = findAuthUserByEmail(normalizedEmail)
                .orElseThrow(() -> new IllegalArgumentException("Invalid email or password"));

        if (!passwordEncoder.matches(request.getPassword(), user.passwordHash())) {
            throw new IllegalArgumentException("Invalid email or password");
        }
        if (user.status() != null && user.status() != UserStatusEnum.ACTIVE) {
            throw new IllegalArgumentException("Tài khoản đã bị khóa");
        }
        AuthCompanySnapshot company = loadAuthCompany(user.companyId())
                .orElseThrow(() -> new IllegalArgumentException("Company not found for user"));
        AuthResponseDto response = buildAuthResponse(company, user.userId());
        log.info("Authenticated user successfully email={} userId={} companyId={} status={}",
                normalizedEmail, user.userId(), user.companyId(), response.getStatus());
        return response;
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
                        : "OTP đã được tạo nhưng SMTP đang tắt. Hãy bật APP_MAIL_ENABLED để gửi mail thật.")
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
        AuthResponseDto response = buildAuthResponse(company, user.userId());
        log.info("Checked registration status email={} userId={} status={}", normalizedEmail, user.userId(),
                response.getStatus());
        return response;
    }

    private AuthResponseDto buildAuthResponse(AuthCompanySnapshot company, Long userId) {
        VerificationStatusEnum verificationStatus = company.verificationStatus() == null
                ? VerificationStatusEnum.PENDING
                : company.verificationStatus();

        if (verificationStatus == VerificationStatusEnum.PENDING) {
            return AuthResponseDto.builder()
                    .status(STATUS_PENDING)
                    .message("Hồ sơ của bạn đang chờ duyệt.")
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
                    .build();
        }

        if (verificationStatus == VerificationStatusEnum.NEED_MORE_INFO) {
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
                    .build();
        }

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
        String normalizedTaxCode = normalizeDigitsOnly(request.getTaxCode());
        if (!isValidTaxCode(normalizedTaxCode)) {
            log.warn("Invalid tax code lookup request taxCode={}", request.getTaxCode());
            throw new IllegalArgumentException("Tax code must be exactly 10 digits");
        }

        TaxCodeLookupSeed seed = TAX_CODE_DIRECTORY.get(normalizedTaxCode);
        if (seed == null) {
            log.info("No company profile found for taxCode={}", normalizedTaxCode);
            return TaxCodeLookupResponseDto.builder()
                    .found(false)
                    .taxCode(normalizedTaxCode)
                    .message("No official profile found for this tax code")
                    .build();
        }

        TaxCodeLookupResponseDto response = TaxCodeLookupResponseDto.builder()
                .found(true)
                .taxCode(normalizedTaxCode)
                .companyName(seed.companyName())
                .province(seed.province())
                .ward(seed.ward())
                .address(seed.address())
                .message("Company profile found")
                .build();
        log.info("Found company profile for taxCode={}", normalizedTaxCode);
        return response;
    }

    private void validateUniqueLoginPhone(String loginPhone) {
        if (userRepository.existsByPhone(loginPhone)) {
            throw new IllegalArgumentException("Phone is already in use: " + loginPhone);
        }
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

        JavaMailSender mailSender = mailSenderProvider.getIfAvailable();
        if (mailSender == null) {
            throw new IllegalStateException("Mail service is unavailable. Please configure SMTP first.");
        }

        try {
            var message = mailSender.createMimeMessage();
            var helper = new MimeMessageHelper(message, false, "UTF-8");
            String resolvedFromAddress = safeTrim(mailFromAddress) != null ? safeTrim(mailFromAddress)
                    : safeTrim(mailUsername);
            if (resolvedFromAddress == null) {
                throw new IllegalStateException(
                        "Mail sender address is missing. Please set MAIL_USERNAME or MAIL_FROM_ADDRESS.");
            }

            helper.setFrom(new InternetAddress(resolvedFromAddress,
                    safeTrim(mailFromName) != null ? safeTrim(mailFromName) : "AgriBridge"));
            helper.setTo(email);
            helper.setSubject("Ma OTP dang ky AgriBridge");
            helper.setText(
                    """
                            Xin chao,

                            Ma OTP dang ky tai khoan AgriBridge cua ban la: %s

                            Ma co hieu luc trong %d phut. Vui long khong chia se ma nay cho nguoi khac.

                            AgriBridge
                            """
                            .formatted(otp, OTP_TTL_MINUTES));
            mailSender.send(message);
            log.info("Sent registration OTP email={} expiresAt={}", email, expiresAt);
        } catch (Exception exception) {
            log.error("Failed to send registration OTP email={} host={} port={} username={} fromAddress={}",
                    email,
                    safeTrim(mailHost),
                    mailPort,
                    safeTrim(mailUsername),
                    safeTrim(mailFromAddress),
                    exception);
            throw new IllegalStateException("Khong the gui email OTP. Vui long kiem tra lai cau hinh SMTP.", exception);
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

    private record TaxCodeLookupSeed(String companyName, String province, String ward, String address) {
    }

    private record PendingRegistrationOtp(String code, LocalDateTime expiresAt, boolean verified) {
        boolean isExpired() {
            return expiresAt == null || LocalDateTime.now().isAfter(expiresAt);
        }

        PendingRegistrationOtp markVerified() {
            return new PendingRegistrationOtp(code, expiresAt, true);
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
        if (company.verificationStatus() != VerificationStatusEnum.APPROVED) {
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
