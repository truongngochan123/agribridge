package com.agribridge.backend.service.impl;

import com.agribridge.backend.dto.AdminRegistrationProfileDto;
import com.agribridge.backend.dto.AdminUploadedDocumentDto;
import com.agribridge.backend.entity.CompanyImageEntity;
import com.agribridge.backend.entity.UserEntity;
import com.agribridge.backend.entity.enums.ImageTypeEnum;
import com.agribridge.backend.entity.enums.UserRoleEnum;
import com.agribridge.backend.entity.enums.VerificationStatusEnum;
import com.agribridge.backend.repository.UserRepository;
import com.agribridge.backend.service.AdminRegistrationService;
import com.agribridge.backend.service.RegistrationWorkflowService;
import com.agribridge.backend.util.RegistrationDescriptionUtils;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.lang.NonNull;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
@Slf4j
public class AdminRegistrationServiceImpl implements AdminRegistrationService {

    private static final DateTimeFormatter DATETIME_FORMATTER = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm");
    private static final TypeReference<Map<String, Object>> NOTE_TYPE = new TypeReference<>() {};

    private final UserRepository userRepository;
    private final JdbcTemplate jdbcTemplate;
    private final RegistrationWorkflowService registrationWorkflowService;
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Override
    @Transactional(readOnly = true)
    public List<AdminRegistrationProfileDto> getRegistrations(VerificationStatusEnum status, String search) {
        log.info("Fetching registrations status={} search={}", status, search);
        List<Object> params = new ArrayList<>();
        StringBuilder sql = new StringBuilder("""
                SELECT
                    id,
                    company_type,
                    business_type,
                    name,
                    owner_name,
                    phone,
                    email,
                    address,
                    province,
                    ward,
                    tax_code,
                    citizen_id,
                    description,
                    created_at,
                    verification_status,
                    verification_note,
                    verified_at,
                    verified_by_user_id
                FROM companies
                WHERE 1 = 1
                """);

        if (status == null) {
            sql.append(" AND COALESCE(verification_status, 'PENDING') <> 'APPROVED'");
        } else {
            sql.append(" AND COALESCE(verification_status, 'PENDING') = ?");
            params.add(status.name());
        }

        String normalizedSearch = normalizeSearch(search);
        if (normalizedSearch != null) {
            sql.append("""
                     AND (
                        LOWER(name) LIKE ?
                        OR LOWER(owner_name) LIKE ?
                        OR LOWER(COALESCE(email, '')) LIKE ?
                        OR LOWER(phone) LIKE ?
                     )
                    """);
            String keyword = "%" + normalizedSearch + "%";
            params.add(keyword);
            params.add(keyword);
            params.add(keyword);
            params.add(keyword);
        }

        sql.append(" ORDER BY created_at DESC");

        List<AdminCompanySnapshot> companies = jdbcTemplate.query(sql.toString(), ADMIN_COMPANY_ROW_MAPPER, params.toArray());
        List<AdminRegistrationProfileDto> profiles = mapCompaniesToProfiles(companies);
        log.info("Fetched {} registrations", profiles.size());
        return profiles;
    }

    @Override
    @Transactional
    public AdminRegistrationProfileDto approveRegistration(
            Long companyId,
            Long adminUserId,
            boolean sendEmail,
            boolean sendNotification) {
        log.info("Approving registration companyId={} adminUserId={} sendEmail={} sendNotification={}",
                companyId, adminUserId, sendEmail, sendNotification);
        return updateRegistration(companyId, adminUserId, VerificationStatusEnum.APPROVED, List.of(), null, sendEmail,
                sendNotification);
    }

    @Override
    @Transactional
    public AdminRegistrationProfileDto requestMoreInfo(
            Long companyId,
            Long adminUserId,
            List<String> reasonCodes,
            String note,
            boolean sendEmail,
            boolean sendNotification) {
        validateDecisionPayload(reasonCodes, note, "Yêu cầu bổ sung");
        return updateRegistration(companyId, adminUserId, VerificationStatusEnum.NEED_MORE_INFO, reasonCodes, note, sendEmail,
                sendNotification);
    }

    @Override
    @Transactional
    public AdminRegistrationProfileDto rejectRegistration(
            Long companyId,
            Long adminUserId,
            List<String> reasonCodes,
            String note,
            boolean sendEmail,
            boolean sendNotification) {
        validateDecisionPayload(reasonCodes, note, "Từ chối duyệt");
        return updateRegistration(companyId, adminUserId, VerificationStatusEnum.REJECTED, reasonCodes, note, sendEmail,
                sendNotification);
    }

    @Override
    @Transactional
    public AdminRegistrationProfileDto reopenRegistration(
            Long companyId,
            Long adminUserId,
            String note,
            boolean sendEmail,
            boolean sendNotification) {
        return updateRegistration(companyId, adminUserId, VerificationStatusEnum.PENDING, List.of(), note, sendEmail,
                sendNotification);
    }

    private AdminRegistrationProfileDto updateRegistration(
            Long companyId,
            Long adminUserId,
            VerificationStatusEnum status,
            List<String> reasonCodes,
            String note,
            boolean sendEmail,
            boolean sendNotification) {
        log.info("Updating registration state companyId={} adminUserId={} status={} sendEmail={} sendNotification={}",
                companyId, adminUserId, status, sendEmail, sendNotification);
        Long resolvedAdminUserId = resolveAdminUserId(adminUserId);
        LocalDateTime processedAt = LocalDateTime.now();
        String verificationNote = buildVerificationNote(status, reasonCodes, note);

        int updatedRows = jdbcTemplate.update(
                """
                UPDATE companies
                SET verification_status = ?,
                    verification_note = ?,
                    verified_by_user_id = ?,
                    verified_status = ?,
                    verified_at = ?
                WHERE id = ?
                """,
                status.name(),
                verificationNote,
                resolvedAdminUserId,
                VerificationStatusEnum.APPROVED.equals(status),
                Timestamp.valueOf(processedAt),
                companyId);

        if (updatedRows == 0) {
            throw new IllegalArgumentException("Company not found: " + companyId);
        }

        log.info("Registration state persisted companyId={} status={} updatedRows={}", companyId, status, updatedRows);
        AdminRegistrationProfileDto profile = loadProfileByCompanyId(companyId);
        log.info("Loaded updated registration profile companyId={} userId={} email={}",
                companyId, profile.getUserId(), profile.getEmail());
        try {
            registrationWorkflowService.sendRegistrationDecision(profile, status, note, sendEmail, sendNotification);
        } catch (Exception exception) {
            log.error("Registration decision persisted but follow-up notification failed for companyId={} status={}",
                    companyId, status, exception);
        }
        log.info("Completed registration state update companyId={} status={}", companyId, status);
        return profile;
    }

    private List<AdminRegistrationProfileDto> mapCompaniesToProfiles(List<AdminCompanySnapshot> companies) {
        if (companies.isEmpty()) {
            return Collections.emptyList();
        }

        List<Long> companyIds = companies.stream().map(AdminCompanySnapshot::companyId).toList();
        Map<Long, UserEntity> ownersByCompanyId = loadOwnersByCompanyId(companyIds).stream()
                .collect(Collectors.toMap(UserEntity::getCompanyId, user -> user, (left, right) -> left));
        Map<Long, List<CompanyImageEntity>> imagesByCompanyId = loadImagesByCompanyId(companyIds).stream()
                .collect(Collectors.groupingBy(CompanyImageEntity::getCompanyId));
        Map<Long, String> adminNames = loadAdminNamesByIds(companies.stream()
                .map(AdminCompanySnapshot::verifiedByUserId)
                .filter(Objects::nonNull)
                .toList());

        return companies.stream()
                .map(company -> mapToProfile(
                        company,
                        ownersByCompanyId.get(company.companyId()),
                        imagesByCompanyId.get(company.companyId()),
                        adminNames.get(company.verifiedByUserId())))
                .toList();
    }

    private AdminRegistrationProfileDto loadProfileByCompanyId(Long companyId) {
        List<AdminRegistrationProfileDto> profiles = mapCompaniesToProfiles(List.of(loadCompanySnapshotById(companyId)));
        if (profiles.isEmpty()) {
            throw new IllegalArgumentException("Company not found: " + companyId);
        }
        return profiles.get(0);
    }

    private Long resolveAdminUserId(Long adminUserId) {
        if (adminUserId == null) {
            return null;
        }
        return userRepository.existsById(adminUserId) ? adminUserId : null;
    }

    private void validateDecisionPayload(List<String> reasonCodes, String note, String actionLabel) {
        boolean hasReasons = reasonCodes != null && reasonCodes.stream().anyMatch(code -> code != null && !code.isBlank());
        boolean hasNote = note != null && !note.isBlank();
        if (!hasReasons && !hasNote) {
            throw new IllegalArgumentException(actionLabel + " cần ít nhất một lý do hoặc ghi chú.");
        }
    }

    private String buildVerificationNote(VerificationStatusEnum status, List<String> reasonCodes, String note) {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("status", status.name());
        payload.put("reasonCodes", reasonCodes == null ? List.of() : reasonCodes.stream()
                .filter(code -> code != null && !code.isBlank())
                .map(String::trim)
                .toList());
        payload.put("note", normalizeNote(note));
        try {
            return objectMapper.writeValueAsString(payload);
        } catch (JsonProcessingException exception) {
            return normalizeNote(note);
        }
    }

    private ParsedVerificationNote parseVerificationNote(String verificationNote) {
        String normalized = normalizeNote(verificationNote);
        if (normalized == null) {
            return new ParsedVerificationNote(List.of(), null);
        }

        try {
            Map<String, Object> payload = objectMapper.readValue(normalized, NOTE_TYPE);
            Object rawCodes = payload.get("reasonCodes");
            List<String> reasonCodes = rawCodes instanceof List<?> list
                    ? list.stream().map(String::valueOf).filter(value -> !value.isBlank()).toList()
                    : List.of();
            String note = payload.get("note") == null ? null : String.valueOf(payload.get("note"));
            return new ParsedVerificationNote(reasonCodes, normalizeNote(note));
        } catch (JsonProcessingException exception) {
            return new ParsedVerificationNote(List.of(), normalized);
        }
    }

    private String normalizeNote(String note) {
        if (note == null) {
            return null;
        }
        String normalized = note.trim();
        return normalized.isEmpty() ? null : normalized;
    }

    private AdminRegistrationProfileDto mapToProfile(
            AdminCompanySnapshot company,
            UserEntity owner,
            List<CompanyImageEntity> images,
            String processedByName) {
        List<CompanyImageEntity> safeImages = images == null ? Collections.emptyList() : images;
        ParsedVerificationNote parsedNote = parseVerificationNote(company.verificationNote());

        List<AdminUploadedDocumentDto> documents = safeImages.stream()
                .filter(image -> ImageTypeEnum.DOCUMENT.equals(image.getImageType()))
                .map(this::mapToDocument)
                .toList();

        List<String> companyImages = safeImages.stream()
                .filter(image -> !ImageTypeEnum.DOCUMENT.equals(image.getImageType()))
                .map(CompanyImageEntity::getImageUrl)
                .toList();

        return AdminRegistrationProfileDto.builder()
                .id("REG-" + company.companyId())
                .userId(owner != null ? owner.getId() : null)
                .companyId(company.companyId())
                .companyType(toLowerValue(company.companyType()))
                .businessType(toLowerValue(company.businessType()))
                .companyName(company.companyName())
                .ownerName(company.ownerName())
                .fullName(owner != null ? owner.getFullName() : company.ownerName())
                .role(owner != null ? toLowerEnum(owner.getRole()) : "owner")
                .phone(owner != null ? owner.getPhone() : company.phone())
                .email(owner != null ? owner.getEmail() : company.email())
                .address(company.address())
                .province(company.province())
                .ward(company.ward())
                .taxCode(company.taxCode())
                .registrationNumber(RegistrationDescriptionUtils.extractRegistrationNumber(company.description()))
                .citizenId(company.citizenId())
                .description(company.description())
                .createdAt(formatDateTime(company.createdAt()))
                .verificationStatus(toVerificationStatus(company.verificationStatus()))
                .verificationStatusLabel(toVerificationStatusLabel(company.verificationStatus()))
                .verificationNote(parsedNote.note())
                .reasonCodes(parsedNote.reasonCodes())
                .lastProcessedAt(formatDateTime(company.verifiedAt()))
                .lastProcessedByUserId(company.verifiedByUserId())
                .lastProcessedByName(processedByName)
                .documents(documents)
                .companyImages(companyImages)
                .build();
    }

    private String formatDateTime(LocalDateTime value) {
        return value == null ? null : value.format(DATETIME_FORMATTER);
    }

    private String toVerificationStatus(VerificationStatusEnum status) {
        return status == null ? VerificationStatusEnum.PENDING.name() : status.name();
    }

    private String toVerificationStatusLabel(VerificationStatusEnum status) {
        if (status == null || status == VerificationStatusEnum.PENDING) {
            return "Chưa duyệt";
        }
        if (status == VerificationStatusEnum.NEED_MORE_INFO) {
            return "Yêu cầu bổ sung";
        }
        if (status == VerificationStatusEnum.REJECTED) {
            return "Đã từ chối";
        }
        return "Đã duyệt";
    }

    private AdminUploadedDocumentDto mapToDocument(CompanyImageEntity image) {
        return AdminUploadedDocumentDto.builder()
                .id(image.getId())
                .type("document")
                .fileName(extractFileName(image.getImageUrl()))
                .uploadedAt(formatDateTime(image.getUploadedAt()))
                .fileUrl(image.getImageUrl())
                .build();
    }

    private String extractFileName(String imageUrl) {
        if (imageUrl == null || imageUrl.isBlank()) {
            return "unknown";
        }
        int index = imageUrl.lastIndexOf('/');
        return index < 0 || index == imageUrl.length() - 1 ? imageUrl : imageUrl.substring(index + 1);
    }

    private String toLowerEnum(Enum<?> value) {
        return value == null ? null : value.name().toLowerCase(Locale.ROOT);
    }

    private String toLowerValue(String value) {
        return value == null || value.isBlank() ? null : value.toLowerCase(Locale.ROOT);
    }

    private String normalizeSearch(String search) {
        if (search == null || search.isBlank()) {
            return null;
        }
        return search.trim().toLowerCase(Locale.ROOT);
    }

    private List<UserEntity> loadOwnersByCompanyId(List<Long> companyIds) {
        if (companyIds.isEmpty()) {
            return Collections.emptyList();
        }

        String placeholders = companyIds.stream().map(id -> "?").collect(Collectors.joining(", "));
        String sql = """
                SELECT
                    id,
                    company_id,
                    full_name,
                    phone,
                    email,
                    role,
                    created_at
                FROM users
                WHERE company_id IN (%s)
                  AND UPPER(LTRIM(RTRIM(role))) = 'OWNER'
                """.formatted(placeholders);

        return jdbcTemplate.query(sql, ADMIN_OWNER_ROW_MAPPER, companyIds.toArray());
    }

    private Map<Long, String> loadAdminNamesByIds(List<Long> adminUserIds) {
        if (adminUserIds.isEmpty()) {
            return Collections.emptyMap();
        }

        String placeholders = adminUserIds.stream().map(id -> "?").collect(Collectors.joining(", "));
        String sql = """
                SELECT
                    id,
                    COALESCE(
                        NULLIF(LTRIM(RTRIM(full_name)), ''),
                        NULLIF(LTRIM(RTRIM(email)), ''),
                        NULLIF(LTRIM(RTRIM(phone)), ''),
                        CONCAT('User #', id)
                    ) AS display_name
                FROM users
                WHERE id IN (%s)
                """.formatted(placeholders);

        return jdbcTemplate.query(sql, ADMIN_NAME_ROW_MAPPER, adminUserIds.toArray()).stream()
                .collect(Collectors.toMap(AdminNameSnapshot::userId, AdminNameSnapshot::fullName, (left, right) -> left));
    }

    private List<CompanyImageEntity> loadImagesByCompanyId(List<Long> companyIds) {
        if (companyIds.isEmpty()) {
            return Collections.emptyList();
        }

        String placeholders = companyIds.stream().map(id -> "?").collect(Collectors.joining(", "));
        String sql = """
                SELECT
                    id,
                    company_id,
                    image_url,
                    image_type,
                    uploaded_at
                FROM company_images
                WHERE company_id IN (%s)
                """.formatted(placeholders);

        return jdbcTemplate.query(sql, ADMIN_IMAGE_ROW_MAPPER, companyIds.toArray());
    }

    private AdminCompanySnapshot loadCompanySnapshotById(Long companyId) {
        List<AdminCompanySnapshot> snapshots = jdbcTemplate.query(
                """
                SELECT
                    id,
                    company_type,
                    business_type,
                    name,
                    owner_name,
                    phone,
                    email,
                    address,
                    province,
                    ward,
                    tax_code,
                    citizen_id,
                    description,
                    created_at,
                    verification_status,
                    verification_note,
                    verified_at,
                    verified_by_user_id
                FROM companies
                WHERE id = ?
                """,
                ADMIN_COMPANY_ROW_MAPPER,
                companyId);

        if (snapshots.isEmpty()) {
            throw new IllegalArgumentException("Company not found: " + companyId);
        }
        return snapshots.get(0);
    }

    private static final @NonNull RowMapper<AdminCompanySnapshot> ADMIN_COMPANY_ROW_MAPPER = new RowMapper<>() {
        @Override
        public AdminCompanySnapshot mapRow(@NonNull ResultSet rs, int rowNum) throws SQLException {
            Timestamp createdAt = rs.getTimestamp("created_at");
            Timestamp verifiedAt = rs.getTimestamp("verified_at");
            return new AdminCompanySnapshot(
                    rs.getLong("id"),
                    Objects.requireNonNull(rs.getString("company_type")),
                    Objects.requireNonNull(rs.getString("business_type")),
                    Objects.requireNonNull(rs.getString("name")),
                    Objects.requireNonNull(rs.getString("owner_name")),
                    Objects.requireNonNull(rs.getString("phone")),
                    rs.getString("email"),
                    Objects.requireNonNull(rs.getString("address")),
                    Objects.requireNonNull(rs.getString("province")),
                    rs.getString("ward"),
                    rs.getString("tax_code"),
                    rs.getString("citizen_id"),
                    rs.getString("description"),
                    createdAt == null ? null : createdAt.toLocalDateTime(),
                    parseVerificationStatus(rs.getString("verification_status")),
                    rs.getString("verification_note"),
                    verifiedAt == null ? null : verifiedAt.toLocalDateTime(),
                    rs.getObject("verified_by_user_id") == null ? null : rs.getLong("verified_by_user_id"));
        }
    };

    private static final @NonNull RowMapper<UserEntity> ADMIN_OWNER_ROW_MAPPER = new RowMapper<>() {
        @Override
        public UserEntity mapRow(@NonNull ResultSet rs, int rowNum) throws SQLException {
            Timestamp createdAt = rs.getTimestamp("created_at");
            return UserEntity.builder()
                    .id(rs.getLong("id"))
                    .companyId(rs.getLong("company_id"))
                    .fullName(Objects.requireNonNull(rs.getString("full_name")))
                    .phone(Objects.requireNonNull(rs.getString("phone")))
                    .email(rs.getString("email"))
                    .role(parseUserRole(rs.getString("role")))
                    .createdAt(createdAt == null ? null : createdAt.toLocalDateTime())
                    .build();
        }
    };

    private static final @NonNull RowMapper<AdminNameSnapshot> ADMIN_NAME_ROW_MAPPER = new RowMapper<>() {
        @Override
        public AdminNameSnapshot mapRow(@NonNull ResultSet rs, int rowNum) throws SQLException {
            return new AdminNameSnapshot(rs.getLong("id"), rs.getString("display_name"));
        }
    };

    private static final @NonNull RowMapper<CompanyImageEntity> ADMIN_IMAGE_ROW_MAPPER = new RowMapper<>() {
        @Override
        public CompanyImageEntity mapRow(@NonNull ResultSet rs, int rowNum) throws SQLException {
            Timestamp uploadedAt = rs.getTimestamp("uploaded_at");
            return CompanyImageEntity.builder()
                    .id(rs.getLong("id"))
                    .companyId(rs.getLong("company_id"))
                    .imageUrl(Objects.requireNonNull(rs.getString("image_url")))
                    .imageType(parseImageType(rs.getString("image_type")))
                    .uploadedAt(uploadedAt == null ? null : uploadedAt.toLocalDateTime())
                    .build();
        }
    };

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

    private static UserRoleEnum parseUserRole(String rawRole) {
        if (rawRole == null || rawRole.isBlank()) {
            return null;
        }
        try {
            return UserRoleEnum.valueOf(rawRole.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException exception) {
            return null;
        }
    }

    private static ImageTypeEnum parseImageType(String rawType) {
        if (rawType == null || rawType.isBlank()) {
            return null;
        }
        try {
            return ImageTypeEnum.valueOf(rawType.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException exception) {
            return null;
        }
    }

    private record AdminCompanySnapshot(
            Long companyId,
            String companyType,
            String businessType,
            String companyName,
            String ownerName,
            String phone,
            String email,
            String address,
            String province,
            String ward,
            String taxCode,
            String citizenId,
            String description,
            LocalDateTime createdAt,
            VerificationStatusEnum verificationStatus,
            String verificationNote,
            LocalDateTime verifiedAt,
            Long verifiedByUserId) {
    }

    private record AdminNameSnapshot(Long userId, String fullName) {
    }

    private record ParsedVerificationNote(List<String> reasonCodes, String note) {
    }
}
