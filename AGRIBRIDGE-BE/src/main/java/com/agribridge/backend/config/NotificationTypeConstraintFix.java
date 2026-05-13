package com.agribridge.backend.config;

import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

/**
 * Keeps the SQL Server CHECK constraint on notifications.type in sync with NotificationTypeEnum.
 * Hibernate ddl-auto:update does not widen existing CHECK constraints after enum values change.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class NotificationTypeConstraintFix {

    private static final String NEW_CONSTRAINT_NAME = "CK_notifications_type_v2";

    private final JdbcTemplate jdbcTemplate;

    @PostConstruct
    public void fixNotificationTypeConstraint() {
        try {
            dropOldConstraints();
            ensureNewConstraintExists();
        } catch (Exception ex) {
            log.error("NotificationTypeConstraintFix: failed to fix constraint - {}", ex.getMessage(), ex);
        }
    }

    private void dropOldConstraints() {
        String findSql = """
                SELECT cc.name
                FROM sys.check_constraints cc
                JOIN sys.columns c
                    ON cc.parent_object_id = c.object_id
                   AND cc.parent_column_id = c.column_id
                WHERE cc.parent_object_id = OBJECT_ID('dbo.notifications')
                  AND c.name = 'type'
                """;

        jdbcTemplate.query(findSql, rs -> {
            String constraintName = rs.getString("name");
            try {
                jdbcTemplate.execute("ALTER TABLE dbo.notifications DROP CONSTRAINT [" + constraintName + "]");
                log.info("NotificationTypeConstraintFix: dropped old constraint '{}'", constraintName);
            } catch (Exception ex) {
                log.warn("NotificationTypeConstraintFix: could not drop constraint '{}': {}",
                        constraintName, ex.getMessage());
            }
        });
    }

    private void ensureNewConstraintExists() {
        Integer count = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM sys.check_constraints WHERE name = ?",
                Integer.class,
                NEW_CONSTRAINT_NAME);
        if (count != null && count > 0) {
            log.debug("NotificationTypeConstraintFix: new constraint already exists, skipping");
            return;
        }

        jdbcTemplate.execute("""
                ALTER TABLE dbo.notifications
                ADD CONSTRAINT CK_notifications_type_v2
                CHECK ([type] IN (
                    'DEBT_REMINDER',
                    'PAYMENT_DUE',
                    'DEBT_OVERDUE',
                    'DEBT_PAYMENT_CONFIRMED',
                    'PRICE_ALERT',
                    'ORDER_UPDATE',
                    'RFQ_RESPONSE',
                    'REGISTRATION_APPROVED',
                    'REGISTRATION_NEED_MORE_INFO',
                    'REGISTRATION_REJECTED',
                    'REGISTRATION_REOPENED',
                    'SYSTEM'
                ))
                """);
        log.info("NotificationTypeConstraintFix: created new constraint '{}'", NEW_CONSTRAINT_NAME);
    }
}
