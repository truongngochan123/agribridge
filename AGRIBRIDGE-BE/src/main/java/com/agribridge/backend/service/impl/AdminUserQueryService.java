package com.agribridge.backend.service.impl;

import com.agribridge.backend.dto.AdminUserAccountDto;
import com.agribridge.backend.entity.enums.CompanyTypeEnum;
import com.agribridge.backend.entity.enums.UserStatusEnum;
import java.sql.Timestamp;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Slf4j
public class AdminUserQueryService {

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

    private final JdbcTemplate jdbcTemplate;

    public AdminUserQueryService(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    @Transactional(readOnly = true)
    public List<AdminUserAccountDto> getApprovedUsers(String search) {
        log.info("Admin query fetching approved users search={}", search);
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
        List<AdminUserAccountDto> users = jdbcTemplate.query(sql.toString(), (rs, rowNum) -> mapToAdminUser(new AdminUserRowSnapshot(
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
                rs.getInt("order_count"))), params.toArray());
        log.info("Admin query fetched {} approved users", users.size());
        return users;
    }

    @Transactional
    public AdminUserAccountDto lockUser(Long userId) {
        log.info("Admin query locking user id={}", userId);
        return updateUserStatus(userId, UserStatusEnum.BLOCKED);
    }

    @Transactional
    public AdminUserAccountDto unlockUser(Long userId) {
        log.info("Admin query unlocking user id={}", userId);
        return updateUserStatus(userId, UserStatusEnum.ACTIVE);
    }

    private AdminUserAccountDto updateUserStatus(Long userId, UserStatusEnum status) {
        int updatedRows = jdbcTemplate.update("UPDATE users SET status = ? WHERE id = ?", status.name(), userId);
        if (updatedRows == 0) {
            log.warn("Admin query cannot update status for missing user id={}", userId);
            throw new IllegalArgumentException("User not found: " + userId);
        }
        AdminUserAccountDto user = loadAdminUserById(userId);
        log.info("Admin query updated user id={} to status={}", userId, status);
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
