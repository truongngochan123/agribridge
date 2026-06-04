package com.agribridge.backend.service.impl;

import com.agribridge.backend.dto.AdminUserAccountDto;
import com.agribridge.backend.dto.ChangePasswordDto;
import com.agribridge.backend.dto.UpdateUserPersonalProfileDto;
import com.agribridge.backend.entity.UserEntity;
import com.agribridge.backend.entity.enums.CompanyTypeEnum;
import com.agribridge.backend.entity.enums.UserStatusEnum;
import com.agribridge.backend.repository.UserRepository;
import com.agribridge.backend.service.UserService;
import java.sql.Timestamp;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Objects;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.BeanUtils;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
@Slf4j
public class UserServiceImpl implements UserService {

    private static final DateTimeFormatter DATE_FORMATTER = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm");
    private static final String ADMIN_USER_SELECT = """
            SELECT
                u.id AS user_id,
                u.company_id,
                CAST(c.name AS NVARCHAR(255)) AS company_name,
                CAST(u.email AS NVARCHAR(255)) AS user_email,
                CAST(c.email AS NVARCHAR(255)) AS company_email,
                CAST(u.phone AS NVARCHAR(255)) AS user_phone,
                CAST(c.phone AS NVARCHAR(255)) AS company_phone,
                CAST(c.company_type AS NVARCHAR(255)) AS company_type,
                CAST(u.status AS NVARCHAR(255)) AS user_status,
                u.created_at,
                CAST(c.owner_name AS NVARCHAR(255)) AS owner_name,
                CAST(c.address AS NVARCHAR(255)) AS address,
                CAST(c.province AS NVARCHAR(255)) AS province,
                CAST(c.tax_code AS NVARCHAR(255)) AS tax_code,
                (
                    SELECT COUNT(1)
                    FROM orders o
                    WHERE o.buyer_company_id = c.id OR o.supplier_company_id = c.id
                ) AS order_count
            FROM users u
            INNER JOIN companies c ON c.id = u.company_id
            WHERE COALESCE(CAST(c.verification_status AS NVARCHAR(255)), N'PENDING') IN (N'APPROVED', N'AUTO_APPROVED', N'MANUAL_APPROVED')
              AND CAST(c.company_type AS NVARCHAR(255)) IN (N'SUPPLIER', N'BUYER')
            """;

    private final UserRepository userRepository;
    private final JdbcTemplate jdbcTemplate;
    private final BCryptPasswordEncoder passwordEncoder = new BCryptPasswordEncoder();

    @Override
    public List<UserEntity> findAll() {
        log.info("Fetching all users");
        List<UserEntity> users = userRepository.findAll();
        log.info("Fetched {} users", users.size());
        return users;
    }

    @Override
    public UserEntity findById(Long id) {
        log.info("Fetching user by id={}", id);
        UserEntity user = Objects.requireNonNull(userRepository.findById(Objects.requireNonNull(id))
                .orElseThrow(() -> new IllegalArgumentException("User not found: " + id)));
        log.info("Fetched user id={} companyId={}", user.getId(), user.getCompanyId());
        return user;
    }

    @Override
    public UserEntity create(UserEntity user) {
        log.info("Creating user for companyId={} email={}",
                user == null ? null : user.getCompanyId(),
                user == null ? null : user.getEmail());
        UserEntity safeUser = Objects.requireNonNull(user);
        safeUser.setId(null);
        UserEntity createdUser = Objects.requireNonNull(userRepository.save(safeUser));
        log.info("Created user id={} companyId={}", createdUser.getId(), createdUser.getCompanyId());
        return createdUser;
    }

    @Override
    public UserEntity update(Long id, UserEntity user) {
        log.info("Updating user id={}", id);
        UserEntity existing = findById(id);
        BeanUtils.copyProperties(Objects.requireNonNull(user), Objects.requireNonNull(existing), "id", "createdAt");
        UserEntity updatedUser = Objects.requireNonNull(userRepository.save(existing));
        log.info("Updated user id={} status={}", updatedUser.getId(), updatedUser.getStatus());
        return updatedUser;
    }

    @Override
    @Transactional
    public UserEntity updatePersonalProfile(Long id, UpdateUserPersonalProfileDto request) {
        log.info("Updating user personal profile id={}", id);
        UserEntity existing = findById(id);

        String fullName = normalizeRequired(request.getFullName(), "Họ và tên là bắt buộc.");
        String phone = normalizeRequired(request.getPhone(), "Số điện thoại là bắt buộc.");
        String email = normalizeOptional(request.getEmail());

        if (userRepository.existsByPhoneAndIdNot(phone, id)) {
            throw new IllegalArgumentException("Số điện thoại đã tồn tại trong hệ thống.");
        }
        if (email != null && userRepository.existsByEmailIgnoreCaseAndIdNot(email, id)) {
            throw new IllegalArgumentException("Email đã tồn tại trong hệ thống.");
        }

        existing.setFullName(fullName);
        existing.setPhone(phone);
        existing.setEmail(email);

        UserEntity updatedUser = Objects.requireNonNull(userRepository.save(existing));
        log.info("Updated user personal profile id={}", updatedUser.getId());
        return updatedUser;
    }

    @Override
    @Transactional
    public void changePassword(Long id, ChangePasswordDto request) {
        log.info("Changing password for user id={}", id);
        UserEntity existing = findById(id);
        String currentPassword = normalizeRequired(request.getCurrentPassword(), "Mật khẩu hiện tại là bắt buộc.");
        String newPassword = normalizeRequired(request.getNewPassword(), "Mật khẩu mới là bắt buộc.");
        if (!passwordEncoder.matches(currentPassword, existing.getPasswordHash())) {
            throw new IllegalArgumentException("CURRENT_PASSWORD_INVALID");
        }
        existing.setPasswordHash(passwordEncoder.encode(newPassword));
        userRepository.save(existing);
        log.info("Changed password for user id={}", id);
    }

    @Override
    public void delete(Long id) {
        log.info("Deleting user id={}", id);
        UserEntity existing = findById(id);
        userRepository.delete(Objects.requireNonNull(existing));
        log.info("Deleted user id={}", id);
    }

    @Override
    @Transactional(readOnly = true)
    public List<AdminUserAccountDto> getApprovedUsers(String search) {
        log.info("Fetching approved users search={}", search);
        String normalizedQuery = normalizeSearch(search);
        List<Object> params = new ArrayList<>();
        StringBuilder sql = new StringBuilder(ADMIN_USER_SELECT);

        if (normalizedQuery != null) {
            sql.append("""
                     AND (
                        LOWER(CAST(c.name AS NVARCHAR(255))) LIKE ?
                        OR LOWER(CAST(COALESCE(u.email, c.email, '') AS NVARCHAR(255))) LIKE ?
                        OR LOWER(CAST(COALESCE(u.phone, c.phone, '') AS NVARCHAR(255))) LIKE ?
                     )
                    """);
            String keyword = "%" + normalizedQuery + "%";
            params.add(keyword);
            params.add(keyword);
            params.add(keyword);
        }

        sql.append(" ORDER BY u.created_at DESC");
        List<AdminUserAccountDto> users = jdbcTemplate.query(sql.toString(),
                (rs, rowNum) -> mapToAdminUser(new AdminUserRowSnapshot(
                        rs.getLong("user_id"),
                        rs.getLong("company_id"),
                        rs.getString("company_name"),
                        rs.getString("user_email"),
                        rs.getString("company_email"),
                        rs.getString("user_phone"),
                        rs.getString("company_phone"),
                        rs.getString("company_type"),
                        rs.getString("user_status"),
                        toLocalDateTime(rs.getTimestamp("created_at")),
                        rs.getString("owner_name"),
                        rs.getString("address"),
                        rs.getString("province"),
                        rs.getString("tax_code"),
                        rs.getInt("order_count"))),
                params.toArray());
        log.info("Fetched {} approved users", users.size());
        return users;
    }

    @Override
    @Transactional
    public AdminUserAccountDto lockUser(Long userId) {
        log.info("Locking user id={}", userId);
        return updateUserStatus(userId, UserStatusEnum.BLOCKED);
    }

    @Override
    @Transactional
    public AdminUserAccountDto unlockUser(Long userId) {
        log.info("Unlocking user id={}", userId);
        return updateUserStatus(userId, UserStatusEnum.ACTIVE);
    }

    private AdminUserAccountDto updateUserStatus(Long userId, UserStatusEnum status) {
        int updatedRows = jdbcTemplate.update("UPDATE users SET status = ? WHERE id = ?", status.name(), userId);
        if (updatedRows == 0) {
            log.warn("Cannot update user status because user id={} was not found", userId);
            throw new IllegalArgumentException("User not found: " + userId);
        }
        AdminUserAccountDto user = loadAdminUserById(userId);
        log.info("Updated user id={} to status={}", userId, status);
        return user;
    }

    private AdminUserAccountDto loadAdminUserById(Long userId) {
        List<AdminUserAccountDto> rows = jdbcTemplate.query(
                ADMIN_USER_SELECT + " AND u.id = ?",
                (rs, rowNum) -> mapToAdminUser(new AdminUserRowSnapshot(
                        rs.getLong("user_id"),
                        rs.getLong("company_id"),
                        rs.getString("company_name"),
                        rs.getString("user_email"),
                        rs.getString("company_email"),
                        rs.getString("user_phone"),
                        rs.getString("company_phone"),
                        rs.getString("company_type"),
                        rs.getString("user_status"),
                        toLocalDateTime(rs.getTimestamp("created_at")),
                        rs.getString("owner_name"),
                        rs.getString("address"),
                        rs.getString("province"),
                        rs.getString("tax_code"),
                        rs.getInt("order_count"))),
                userId);

        if (rows.isEmpty()) {
            throw new IllegalArgumentException("Approved company not found for user: " + userId);
        }

        return rows.get(0);
    }

    private AdminUserAccountDto mapToAdminUser(AdminUserRowSnapshot row) {
        UserStatusEnum normalizedStatus = normalizeUserStatus(parseUserStatus(row.userStatus()));
        CompanyTypeEnum companyType = parseCompanyType(row.companyType());

        return AdminUserAccountDto.builder()
                .userId(row.userId())
                .companyId(row.companyId())
                .companyName(defaultString(row.companyName()))
                .email(firstNonBlank(row.userEmail(), row.companyEmail()))
                .phone(firstNonBlank(row.userPhone(), row.companyPhone(), "Chưa cập nhật"))
                .companyType(companyType != null ? companyType.name() : CompanyTypeEnum.BUYER.name())
                .companyTypeLabel(toCompanyTypeLabel(companyType))
                .userStatus(normalizedStatus.name())
                .userStatusLabel(toUserStatusLabel(normalizedStatus))
                .orderCount(row.orderCount())
                .rating("N/A")
                .joinedAt(row.createdAt() != null ? row.createdAt().format(DATE_FORMATTER) : null)
                .ownerName(row.ownerName())
                .address(row.address())
                .province(row.province())
                .taxCode(row.taxCode())
                .build();
    }

    private UserStatusEnum normalizeUserStatus(UserStatusEnum status) {
        if (status == null || status == UserStatusEnum.ACTIVE) {
            return UserStatusEnum.ACTIVE;
        }
        return UserStatusEnum.BLOCKED;
    }

    private UserStatusEnum parseUserStatus(String rawStatus) {
        if (rawStatus == null || rawStatus.isBlank()) {
            return UserStatusEnum.ACTIVE;
        }
        try {
            return UserStatusEnum.valueOf(rawStatus.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException exception) {
            return UserStatusEnum.ACTIVE;
        }
    }

    private CompanyTypeEnum parseCompanyType(String rawCompanyType) {
        if (rawCompanyType == null || rawCompanyType.isBlank()) {
            return null;
        }
        try {
            return CompanyTypeEnum.valueOf(rawCompanyType.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException exception) {
            return null;
        }
    }

    private String normalizeSearch(String search) {
        if (search == null || search.isBlank()) {
            return null;
        }
        return search.trim().toLowerCase(Locale.ROOT);
    }

    private LocalDateTime toLocalDateTime(Timestamp timestamp) {
        return timestamp == null ? null : timestamp.toLocalDateTime();
    }

    private String firstNonBlank(String... values) {
        for (String value : values) {
            if (value != null && !value.isBlank()) {
                return value;
            }
        }
        return null;
    }

    private String defaultString(String value) {
        return value == null ? "" : value;
    }

    private String toCompanyTypeLabel(CompanyTypeEnum companyType) {
        if (companyType == CompanyTypeEnum.SUPPLIER) {
            return "Nhà cung cấp";
        }
        if (companyType == CompanyTypeEnum.BUYER) {
            return "Nhà buôn";
        }
        return "Không xác định";
    }

    private String toUserStatusLabel(UserStatusEnum status) {
        if (status == UserStatusEnum.BLOCKED) {
            return "Bị khóa";
        }
        return "Hoạt động";
    }

    private String normalizeRequired(String value, String errorMessage) {
        String normalized = normalizeOptional(value);
        if (normalized == null) {
            throw new IllegalArgumentException(errorMessage);
        }
        return normalized;
    }

    private String normalizeOptional(String value) {
        if (value == null) {
            return null;
        }
        String normalized = value.trim();
        return normalized.isEmpty() ? null : normalized;
    }

    private record AdminUserRowSnapshot(
            Long userId,
            Long companyId,
            String companyName,
            String userEmail,
            String companyEmail,
            String userPhone,
            String companyPhone,
            String companyType,
            String userStatus,
            LocalDateTime createdAt,
            String ownerName,
            String address,
            String province,
            String taxCode,
            Integer orderCount) {
    }
}
