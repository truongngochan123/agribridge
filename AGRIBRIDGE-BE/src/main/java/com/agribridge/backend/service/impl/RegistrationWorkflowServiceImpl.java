package com.agribridge.backend.service.impl;

import com.agribridge.backend.dto.AdminRegistrationProfileDto;
import com.agribridge.backend.dto.AdminUploadedDocumentDto;
import com.agribridge.backend.dto.AuthResponseDto;
import com.agribridge.backend.dto.RegistrationResubmitProfileDto;
import com.agribridge.backend.dto.RegistrationResubmitRequestDto;
import com.agribridge.backend.entity.CompanyEntity;
import com.agribridge.backend.entity.CompanyImageEntity;
import com.agribridge.backend.entity.NotificationEntity;
import com.agribridge.backend.entity.UserEntity;

import com.agribridge.backend.entity.enums.ImageTypeEnum;
import com.agribridge.backend.entity.enums.NotificationTypeEnum;
import com.agribridge.backend.entity.enums.UserRoleEnum;
import com.agribridge.backend.entity.enums.UserStatusEnum;
import com.agribridge.backend.entity.enums.VerificationStatusEnum;
import com.agribridge.backend.repository.CompanyImageRepository;
import com.agribridge.backend.repository.CompanyRepository;
import com.agribridge.backend.repository.NotificationRepository;
import com.agribridge.backend.repository.UserRepository;
import com.agribridge.backend.service.RegistrationWorkflowService;
import com.agribridge.backend.util.RegistrationDescriptionUtils;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Locale;
import java.util.Objects;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
@Slf4j
public class RegistrationWorkflowServiceImpl implements RegistrationWorkflowService {

    private static final String STATUS_PENDING = "PENDING_VERIFICATION";
    private static final BigDecimal DEFAULT_CREDIT_LIMIT = BigDecimal.ZERO;
    private static final int MAX_IMAGE_URL_LENGTH = 240;

    private final CompanyRepository companyRepository;
    private final CompanyImageRepository companyImageRepository;
    private final UserRepository userRepository;
    private final NotificationRepository notificationRepository;
    private final JdbcTemplate jdbcTemplate;
    private final ObjectProvider<JavaMailSender> mailSenderProvider;

    @Value("${app.mail.enabled:false}")
    private boolean mailEnabled;

    @Value("${spring.mail.username:no-reply@agribridge.local}")
    private String mailFrom;

    @Override
    @Transactional(readOnly = true)
    public RegistrationResubmitProfileDto getResubmissionDraft(Long companyId, Long userId) {
        log.info("Loading registration resubmission draft companyId={} userId={}", companyId, userId);
        CompanyEntity company = findCompany(companyId);
        UserEntity owner = findOwner(company.getId());
        ensureSameOwner(owner, userId);

        List<CompanyImageEntity> images = companyImageRepository.findByCompanyIdOrderByUploadedAtDesc(company.getId());
        String logoUrl = images.stream()
                .filter(image -> image.getImageType() == ImageTypeEnum.LOGO)
                .map(CompanyImageEntity::getImageUrl)
                .findFirst()
                .orElse(null);

        List<AdminUploadedDocumentDto> documents = images.stream()
                .filter(image -> image.getImageType() == ImageTypeEnum.DOCUMENT)
                .map(image -> AdminUploadedDocumentDto.builder()
                        .id(image.getId())
                        .type("document")
                        .fileName(extractFileName(image.getImageUrl()))
                        .uploadedAt(image.getUploadedAt() == null ? null : image.getUploadedAt().toString())
                        .fileUrl(image.getImageUrl())
                        .build())
                .toList();

        RegistrationResubmitProfileDto profile = RegistrationResubmitProfileDto.builder()
                .companyId(company.getId())
                .userId(owner.getId())
                .companyType(toLower(company.getCompanyType()))
                .businessType(toLower(company.getBusinessType()))
                .companyName(company.getName())
                .ownerName(company.getOwnerName())
                .fullName(owner.getFullName())
                .loginPhone(owner.getPhone())
                .loginEmail(owner.getEmail())
                .citizenId(company.getCitizenId())
                .taxCode(company.getTaxCode())
                .registrationNumber(RegistrationDescriptionUtils.extractRegistrationNumber(company.getDescription()))
                .companyPhone(company.getPhone())
                .companyEmail(company.getEmail())
                .address(company.getAddress())
                .province(company.getProvince())
                .ward(company.getWard())
                .description(RegistrationDescriptionUtils.extractDisplayDescription(company.getDescription()))
                .logoUrl(logoUrl)
                .documents(documents)
                .verificationStatus(company.getVerificationStatus() == null ? VerificationStatusEnum.PENDING.name() : company.getVerificationStatus().name())
                .verificationNote(company.getVerificationNote())
                .build();
        log.info("Loaded registration resubmission draft companyId={} documentCount={}", companyId, documents.size());
        return profile;
    }

    @Override
    @Transactional
    public AuthResponseDto resubmitRegistration(RegistrationResubmitRequestDto request) {
        log.info("Resubmitting registration companyId={} userId={}", request.getCompanyId(), request.getUserId());
        CompanyEntity company = findCompany(request.getCompanyId());
        UserEntity owner = findOwner(company.getId());
        ensureSameOwner(owner, request.getUserId());

        String normalizedLoginPhone = normalizePhone(request.getLoginPhone());
        String normalizedLoginEmail = normalizeEmail(request.getLoginEmail());
        String normalizedCompanyEmail = normalizeEmail(request.getCompanyEmail());
        String normalizedCompanyPhone = normalizePhone(firstNonBlank(request.getCompanyPhone(), request.getLoginPhone()));
        String normalizedCitizenId = normalizeDigitsOnly(request.getCitizenId());
        String normalizedTaxCode = normalizeDigitsOnly(request.getTaxCode());
        String normalizedLogoUrl = sanitizeImageUrl(request.getLogoUrl());
        List<String> normalizedDocuments = normalizeDocumentUrls(request.getDocumentUrls());

        validateRequired(request.getCompanyName(), "Tên doanh nghi?p là b?t bu?c.");
        validateRequired(request.getOwnerName(), "Ngu?i d?i di?n là b?t bu?c.");
        validateRequired(request.getFullName(), "H? tên tài kho?n là b?t bu?c.");
        validateRequired(normalizedLoginPhone, "S? di?n tho?i dang nh?p là b?t bu?c.");
        validateRequired(request.getProvince(), "T?nh / Thành là b?t bu?c.");
        validateRequired(request.getAddress(), "Đ?a ch? là b?t bu?c.");

        validateUniquePhoneForResubmit(normalizedLoginPhone, owner.getId());
        validateUniqueEmailForResubmit(normalizedLoginEmail, normalizedCompanyEmail, owner.getId(), company.getId());
        validateUniqueTaxCodeForResubmit(normalizedTaxCode, company.getId());
        validateUniqueCitizenIdForResubmit(normalizedCitizenId, company.getId());

        company.setName(request.getCompanyName().trim());
        company.setOwnerName(request.getOwnerName().trim());
        company.setCitizenId(normalizedCitizenId);
        company.setTaxCode(normalizedTaxCode);
        company.setPhone(normalizedCompanyPhone);
        company.setEmail(firstNonBlank(normalizedCompanyEmail, normalizedLoginEmail));
        company.setAddress(request.getAddress().trim());
        company.setProvince(request.getProvince().trim());
        company.setWard(normalizeOptional(request.getWard()));
        company.setDescription(RegistrationDescriptionUtils.buildDescription(request.getDescription(), request.getRegistrationNumber()));
        company.setVerifiedStatus(false);
        company.setVerificationStatus(VerificationStatusEnum.PENDING);
        company.setVerificationNote(null);
        company.setVerifiedAt(null);
        company.setVerifiedByUserId(null);
        if (company.getCreditLimit() == null) {
            company.setCreditLimit(DEFAULT_CREDIT_LIMIT);
        }
        Objects.requireNonNull(companyRepository.save(company));

        owner.setFullName(request.getFullName().trim());
        owner.setPhone(normalizedLoginPhone);
        owner.setEmail(normalizedLoginEmail);
        if (owner.getStatus() == UserStatusEnum.LOCKED) {
            owner.setStatus(UserStatusEnum.BLOCKED);
        }
        Objects.requireNonNull(userRepository.save(owner));

        companyImageRepository.deleteByCompanyIdAndImageType(company.getId(), ImageTypeEnum.LOGO);
        companyImageRepository.deleteByCompanyIdAndImageType(company.getId(), ImageTypeEnum.DOCUMENT);
        saveLogo(company.getId(), normalizedLogoUrl);
        saveDocuments(company.getId(), normalizedDocuments);

        AuthResponseDto response = AuthResponseDto.builder()
                .status(STATUS_PENDING)
                .message("H? so dă du?c g?i l?i và dang ch? duy?t.")
                .redirectPath("/onboarding/verification/pending")
                .userId(owner.getId())
                .companyId(company.getId())
                .companyType(toLower(company.getCompanyType()))
                .userStatus(owner.getStatus() == null ? null : owner.getStatus().name())
                .verificationStatus(VerificationStatusEnum.PENDING.name())
                .verificationNote(null)
                .trustLevel(company.getTrustLevel())
                .creditLimit(company.getCreditLimit())
                .canUseCredit(false)
                .build();
        log.info("Resubmitted registration companyId={} ownerId={} documentCount={}",
                company.getId(), owner.getId(), normalizedDocuments.size());
        return response;
    }

    @Override
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void sendRegistrationDecision(
            AdminRegistrationProfileDto profile,
            VerificationStatusEnum status,
            String note,
            boolean sendEmail,
            boolean sendNotification) {
        log.info("Sending registration decision companyId={} userId={} status={} sendEmail={} sendNotification={}",
                profile == null ? null : profile.getCompanyId(),
                profile == null ? null : profile.getUserId(),
                status,
                sendEmail,
                sendNotification);
        if (sendNotification) {
            try {
                createNotification(profile, status, note);
            } catch (Exception exception) {
                log.error("Failed to create registration notification companyId={} userId={} status={}",
                        profile == null ? null : profile.getCompanyId(),
                        profile == null ? null : profile.getUserId(),
                        status,
                        exception);
            }
        }
        if (sendEmail) {
            try {
                sendEmail(profile, status, note);
            } catch (Exception exception) {
                log.error("Failed to send registration decision email companyId={} userId={} status={}",
                        profile == null ? null : profile.getCompanyId(),
                        profile == null ? null : profile.getUserId(),
                        status,
                        exception);
            }
        }
        log.info("Processed registration decision companyId={} status={}",
                profile == null ? null : profile.getCompanyId(), status);
    }

    private void createNotification(AdminRegistrationProfileDto profile, VerificationStatusEnum status, String note) {
        if (profile.getUserId() == null || profile.getCompanyId() == null) {
            log.warn("Skipping registration notification because userId/companyId is missing status={}", status);
            return;
        }
        notificationRepository.save(NotificationEntity.builder()
                .userId(profile.getUserId())
                .companyId(profile.getCompanyId())
                .type(resolveNotificationType(status))
                .title(resolveTitle(status))
                .body(resolveBody(status, profile.getCompanyName(), note))
                .refTable("companies")
                .refId(profile.getCompanyId())
                .isRead(false)
                .createdAt(LocalDateTime.now())
                .build());
        log.info("Created registration notification companyId={} userId={} status={}",
                profile.getCompanyId(), profile.getUserId(), status);
    }

    private void sendEmail(AdminRegistrationProfileDto profile, VerificationStatusEnum status, String note) {
        if (profile.getEmail() == null || profile.getEmail().isBlank()) {
            log.warn("Cannot send registration email because recipient email is missing for companyId={}", profile.getCompanyId());
            return;
        }
        if (!mailEnabled) {
            log.warn("Mail is disabled. Skipping registration email for companyId={} status={}", profile.getCompanyId(), status);
            return;
        }
        JavaMailSender mailSender = mailSenderProvider.getIfAvailable();
        if (mailSender == null) {
            log.warn("JavaMailSender bean is unavailable. Skipping registration email for companyId={} status={}", profile.getCompanyId(), status);
            return;
        }

        SimpleMailMessage message = new SimpleMailMessage();
        message.setFrom(mailFrom);
        message.setTo(profile.getEmail());
        message.setSubject(resolveTitle(status));
        message.setText(resolveEmailBody(profile, status, note));
        mailSender.send(message);
        log.info("Sent registration decision email companyId={} status={} recipient={}",
                profile.getCompanyId(), status, profile.getEmail());
    }

    private String resolveEmailBody(AdminRegistrationProfileDto profile, VerificationStatusEnum status, String note) {
        String recipientName = firstNonBlank(profile.getOwnerName(), profile.getFullName(), profile.getCompanyName(), "Quư khách");
        StringBuilder builder = new StringBuilder();
        builder.append("Xin chào ").append(recipientName).append(",\n\n");
        builder.append(resolveBody(status, profile.getCompanyName(), note)).append("\n\n");
        if (status == VerificationStatusEnum.NEED_MORE_INFO) {
            builder.append("Vui ḷng dang nh?p vào AgriBridge, c?p nh?t l?i h? so và g?i l?i d? du?c xét duy?t.\n\n");
        } else if (status == VerificationStatusEnum.REJECTED) {
            builder.append("H? so hi?n t?i không th? ti?p t?c s? d?ng. Vui ḷng dang kư l?i b?ng thông tin h?p l? n?u mu?n tham gia n?n t?ng.\n\n");
        } else if (status == VerificationStatusEnum.PENDING) {
            builder.append("H? so c?a b?n dă du?c m? l?i và chuy?n v? tr?ng thái ch? duy?t.\n\n");
        } else {
            builder.append("B?n dă có th? truy c?p h? th?ng b́nh thu?ng.\n\n");
        }
        builder.append("Trân tr?ng,\nĐ?i ngu AgriBridge");
        return builder.toString();
    }

    private NotificationTypeEnum resolveNotificationType(VerificationStatusEnum status) {
        if (status == VerificationStatusEnum.APPROVED) {
            return NotificationTypeEnum.REGISTRATION_APPROVED;
        }
        if (status == VerificationStatusEnum.NEED_MORE_INFO) {
            return NotificationTypeEnum.REGISTRATION_NEED_MORE_INFO;
        }
        if (status == VerificationStatusEnum.REJECTED) {
            return NotificationTypeEnum.REGISTRATION_REJECTED;
        }
        return NotificationTypeEnum.REGISTRATION_REOPENED;
    }

    private String resolveTitle(VerificationStatusEnum status) {
        if (status == VerificationStatusEnum.APPROVED) {
            return "H? so dă du?c phê duy?t";
        }
        if (status == VerificationStatusEnum.NEED_MORE_INFO) {
            return "Yêu c?u b? sung h? so";
        }
        if (status == VerificationStatusEnum.REJECTED) {
            return "H? so dă b? t? ch?i";
        }
        return "H? so dă du?c m? l?i";
    }

    private String resolveBody(VerificationStatusEnum status, String companyName, String note) {
        String safeCompanyName = firstNonBlank(companyName, "H? so doanh nghi?p");
        String safeNote = normalizeOptional(note);
        if (status == VerificationStatusEnum.APPROVED) {
            return safeCompanyName + " dă du?c phê duy?t và có th? s? d?ng h? th?ng.";
        }
        if (status == VerificationStatusEnum.NEED_MORE_INFO) {
            return safeNote == null
                    ? safeCompanyName + " c?n b? sung thêm thông tin tru?c khi du?c xét duy?t ti?p."
                    : safeCompanyName + " c?n b? sung h? so: " + safeNote;
        }
        if (status == VerificationStatusEnum.REJECTED) {
            return safeNote == null
                    ? safeCompanyName + " dă b? t? ch?i. Vui ḷng dang kư l?i v?i h? so h?p l?."
                    : safeCompanyName + " dă b? t? ch?i: " + safeNote;
        }
        return safeNote == null
                ? safeCompanyName + " dă du?c m? l?i và chuy?n v? tr?ng thái ch? duy?t."
                : safeCompanyName + " dă du?c m? l?i: " + safeNote;
    }

    private void saveLogo(Long companyId, String logoUrl) {
        if (logoUrl == null) {
            return;
        }
        companyImageRepository.save(CompanyImageEntity.builder()
                .companyId(companyId)
                .imageUrl(logoUrl)
                .imageType(ImageTypeEnum.LOGO)
                .uploadedAt(LocalDateTime.now())
                .build());
    }

    private void saveDocuments(Long companyId, List<String> documentUrls) {
        if (documentUrls.isEmpty()) {
            return;
        }
        documentUrls.forEach(url -> companyImageRepository.save(CompanyImageEntity.builder()
                .companyId(companyId)
                .imageUrl(url)
                .imageType(ImageTypeEnum.DOCUMENT)
                .uploadedAt(LocalDateTime.now())
                .build()));
    }

    private CompanyEntity findCompany(Long companyId) {
        return companyRepository.findById(Objects.requireNonNull(companyId))
                .orElseThrow(() -> new IllegalArgumentException("Company not found: " + companyId));
    }

    private UserEntity findOwner(Long companyId) {
        return userRepository.findFirstByCompanyIdAndRole(companyId, UserRoleEnum.OWNER)
                .orElseThrow(() -> new IllegalArgumentException("Owner user not found for company: " + companyId));
    }

    private void ensureSameOwner(UserEntity owner, Long userId) {
        if (userId == null || !Objects.equals(owner.getId(), userId)) {
            throw new IllegalArgumentException("You do not have permission to update this registration.");
        }
    }

    private void validateUniquePhoneForResubmit(String normalizedPhone, Long currentUserId) {
        Integer count = jdbcTemplate.queryForObject(
                "SELECT COUNT(1) FROM users WHERE phone = ? AND id <> ?",
                Integer.class,
                normalizedPhone,
                currentUserId);
        if (count != null && count > 0) {
            throw new IllegalArgumentException("S? di?n tho?i dang nh?p dă t?n t?i trong h? th?ng.");
        }
    }

    private void validateUniqueEmailForResubmit(
            String loginEmail,
            String companyEmail,
            Long currentUserId,
            Long currentCompanyId) {
        if (loginEmail != null) {
            Integer userCount = jdbcTemplate.queryForObject(
                    "SELECT COUNT(1) FROM users WHERE LOWER(email) = ? AND id <> ?",
                    Integer.class,
                    loginEmail,
                    currentUserId);
            Integer companyCount = jdbcTemplate.queryForObject(
                    "SELECT COUNT(1) FROM companies WHERE LOWER(email) = ? AND id <> ?",
                    Integer.class,
                    loginEmail,
                    currentCompanyId);
            if ((userCount != null && userCount > 0) || (companyCount != null && companyCount > 0)) {
                throw new IllegalArgumentException("Email dang nh?p dă t?n t?i trong h? th?ng.");
            }
        }
        if (companyEmail != null && !companyEmail.equals(loginEmail)) {
            Integer userCount = jdbcTemplate.queryForObject(
                    "SELECT COUNT(1) FROM users WHERE LOWER(email) = ? AND id <> ?",
                    Integer.class,
                    companyEmail,
                    currentUserId);
            Integer companyCount = jdbcTemplate.queryForObject(
                    "SELECT COUNT(1) FROM companies WHERE LOWER(email) = ? AND id <> ?",
                    Integer.class,
                    companyEmail,
                    currentCompanyId);
            if ((userCount != null && userCount > 0) || (companyCount != null && companyCount > 0)) {
                throw new IllegalArgumentException("Email doanh nghi?p dă t?n t?i trong h? th?ng.");
            }
        }
    }

    private void validateUniqueTaxCodeForResubmit(String taxCode, Long currentCompanyId) {
        if (taxCode == null) {
            return;
        }
        Integer count = jdbcTemplate.queryForObject(
                "SELECT COUNT(1) FROM companies WHERE tax_code = ? AND id <> ?",
                Integer.class,
                taxCode,
                currentCompanyId);
        if (count != null && count > 0) {
            throw new IllegalArgumentException("Mă s? thu? dă t?n t?i trong h? th?ng.");
        }
    }

    private void validateUniqueCitizenIdForResubmit(String citizenId, Long currentCompanyId) {
        if (citizenId == null) {
            return;
        }
        Integer count = jdbcTemplate.queryForObject(
                "SELECT COUNT(1) FROM companies WHERE citizen_id = ? AND id <> ?",
                Integer.class,
                citizenId,
                currentCompanyId);
        if (count != null && count > 0) {
            throw new IllegalArgumentException("CCCD dă liên k?t v?i h? so doanh nghi?p khác.");
        }
    }

    private void validateRequired(String value, String message) {
        if (value == null || value.isBlank()) {
            throw new IllegalArgumentException(message);
        }
    }

    private List<String> normalizeDocumentUrls(List<String> documentUrls) {
        if (documentUrls == null || documentUrls.isEmpty()) {
            return List.of();
        }
        return documentUrls.stream()
                .map(this::sanitizeImageUrl)
                .filter(Objects::nonNull)
                .distinct()
                .toList();
    }

    private String sanitizeImageUrl(String rawUrl) {
        String normalized = normalizeOptional(rawUrl);
        if (normalized == null) {
            return null;
        }
        if (normalized.startsWith("data:") || normalized.startsWith("upload://")) {
            return null;
        }
        return normalized.length() > MAX_IMAGE_URL_LENGTH ? normalized.substring(0, MAX_IMAGE_URL_LENGTH) : normalized;
    }

    private String normalizePhone(String phone) {
        String digitsOnly = normalizeDigitsOnly(phone);
        if (digitsOnly == null) {
            return null;
        }
        if (digitsOnly.startsWith("84") && digitsOnly.length() > 9) {
            return "0" + digitsOnly.substring(2);
        }
        return digitsOnly;
    }

    private String normalizeDigitsOnly(String value) {
        String normalized = normalizeOptional(value);
        return normalized == null ? null : normalized.replaceAll("\\D", "");
    }

    private String normalizeEmail(String email) {
        String normalized = normalizeOptional(email);
        return normalized == null ? null : normalized.toLowerCase(Locale.ROOT);
    }

    private String normalizeOptional(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private String toLower(Enum<?> value) {
        return value == null ? null : value.name().toLowerCase(Locale.ROOT);
    }

    private String extractFileName(String imageUrl) {
        if (imageUrl == null || imageUrl.isBlank()) {
            return "document";
        }
        int index = imageUrl.lastIndexOf('/');
        return index >= 0 && index < imageUrl.length() - 1 ? imageUrl.substring(index + 1) : imageUrl;
    }

    private String firstNonBlank(String... values) {
        for (String value : values) {
            String normalized = normalizeOptional(value);
            if (normalized != null) {
                return normalized;
            }
        }
        return null;
    }
}
