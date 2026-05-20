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
    private static final String ALLOWED_TYPES = """
            'ORDER_CREATED_FOR_SUPPLIER',
            'ORDER_CONFIRMED_FOR_BUYER',
            'ORDER_CANCELLED_FOR_BUYER',
            'ORDER_CANCELLED_BY_BUYER_FOR_SUPPLIER',
            'PAYMENT_DEPOSIT_PAID_FOR_SUPPLIER',
            'PAYMENT_REMAINING_PAID_FOR_SUPPLIER',
            'PAYMENT_COMPLETED_FOR_BUYER',
            'PAYMENT_REMAINING_REQUIRED',
            'DELIVERY_IN_TRANSIT_FOR_BUYER',
            'DELIVERY_WAITING_CONFIRMATION_FOR_BUYER',
            'DELIVERY_FAILED',
            'SHIPMENT_INCIDENT',
            'DELIVERY_DISPUTE',
            'BUYER_COMPLAINT',
            'RFQ_CREATED_FOR_SUPPLIER',
            'RFQ_QUOTE_SENT_FOR_BUYER',
            'RFQ_QUOTE_SELECTED_FOR_SUPPLIER',
            'COMPLAINT_CREATED_FOR_SUPPLIER',
            'COMPLAINT_RESPONDED_FOR_BUYER',
            'DEBT_REMINDER',
            'DEBT_CREDIT_LIMIT_GRANTED',
            'DEBT_CREDIT_LIMIT_SUSPENDED',
            'DEBT_CREDIT_LIMIT_CLOSED',
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
            """;

    private final JdbcTemplate jdbcTemplate;

    @PostConstruct
    public void fixNotificationTypeConstraint() {
        try {
            dropOldConstraints();
            normalizeLegacyTypes();
            ensureNewConstraintExists();
        } catch (Exception ex) {
            log.error("NotificationTypeConstraintFix: failed to fix constraint - {}", ex.getMessage(), ex);
        }
    }

    private void dropOldConstraints() {
        String findSql = """
                SELECT cc.name
                FROM sys.check_constraints cc
                WHERE cc.parent_object_id = OBJECT_ID('dbo.notifications')
                  AND cc.definition LIKE '%[type]%'
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

    private void normalizeLegacyTypes() {
        String allowedTypes = ALLOWED_TYPES.replace("\n", " ");
        int uppercased = jdbcTemplate.update("""
                UPDATE dbo.notifications
                   SET [type] = UPPER([type])
                 WHERE [type] IS NOT NULL
                   AND [type] COLLATE Latin1_General_CS_AS <> UPPER([type]) COLLATE Latin1_General_CS_AS
                   AND UPPER([type]) IN (
                """ + allowedTypes + """
                   )
                """);
        if (uppercased > 0) {
            log.info("NotificationTypeConstraintFix: normalized {} legacy notification type values", uppercased);
        }

        int repaired = jdbcTemplate.update("""
                UPDATE dbo.notifications
                   SET [type] = 'SYSTEM'
                 WHERE [type] IS NULL
                    OR [type] NOT IN (
                """ + allowedTypes + """
                   )
                """);
        if (repaired > 0) {
            log.warn("NotificationTypeConstraintFix: repaired {} unsupported notification type values as SYSTEM", repaired);
        }
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
                """ + ALLOWED_TYPES + """
                ))
                """);
        log.info("NotificationTypeConstraintFix: created new constraint '{}'", NEW_CONSTRAINT_NAME);
    }
}
