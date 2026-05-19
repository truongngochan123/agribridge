package com.agribridge.backend.config;

import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

/**
 * Keeps the SQL Server CHECK constraint on credit_limits.status in sync with CreditLimitStatusEnum.
 * Hibernate ddl-auto:update does not widen existing enum CHECK constraints after values change.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class CreditLimitStatusConstraintFix {

    private static final String NEW_CONSTRAINT_NAME = "CK_credit_limits_status_flow";

    private final JdbcTemplate jdbcTemplate;

    @PostConstruct
    public void fixCreditLimitStatusConstraint() {
        try {
            ensureStatusColumnExists();
            dropOldConstraints();
            normalizeLegacyStatuses();
            ensureNewConstraintExists();
        } catch (Exception ex) {
            log.error("CreditLimitStatusConstraintFix: failed to fix constraint - {}", ex.getMessage(), ex);
        }
    }

    private void ensureStatusColumnExists() {
        Integer count = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM sys.columns WHERE object_id = OBJECT_ID('dbo.credit_limits') AND name = 'status'",
                Integer.class);
        if (count != null && count > 0) return;

        jdbcTemplate.execute("ALTER TABLE dbo.credit_limits ADD status VARCHAR(30) NULL");
        log.info("CreditLimitStatusConstraintFix: added credit_limits.status column");
    }

    private void dropOldConstraints() {
        String findSql = """
                SELECT cc.name
                FROM sys.check_constraints cc
                WHERE cc.parent_object_id = OBJECT_ID('dbo.credit_limits')
                  AND (
                        cc.definition LIKE '%[status]%'
                     OR cc.definition LIKE '%status%'
                  )
                """;

        jdbcTemplate.query(findSql, rs -> {
            String constraintName = rs.getString("name");
            try {
                jdbcTemplate.execute("ALTER TABLE dbo.credit_limits DROP CONSTRAINT [" + constraintName + "]");
                log.info("CreditLimitStatusConstraintFix: dropped old constraint '{}'", constraintName);
            } catch (Exception ex) {
                log.warn("CreditLimitStatusConstraintFix: could not drop constraint '{}': {}",
                        constraintName, ex.getMessage());
            }
        });
    }

    private void normalizeLegacyStatuses() {
        int initialized = jdbcTemplate.update("""
                UPDATE dbo.credit_limits
                   SET status = CASE WHEN is_blocked = 1 THEN 'SUSPENDED' ELSE 'ACTIVE' END
                 WHERE status IS NULL
                """);
        if (initialized > 0) {
            log.info("CreditLimitStatusConstraintFix: initialized {} empty credit limit statuses", initialized);
        }

        int uppercased = jdbcTemplate.update("""
                UPDATE dbo.credit_limits
                   SET status = UPPER(status)
                 WHERE status IS NOT NULL
                   AND status COLLATE Latin1_General_CS_AS <> UPPER(status) COLLATE Latin1_General_CS_AS
                """);
        if (uppercased > 0) {
            log.info("CreditLimitStatusConstraintFix: normalized {} lowercase credit limit statuses", uppercased);
        }

        int blocked = jdbcTemplate.update("""
                UPDATE dbo.credit_limits
                   SET status = 'SUSPENDED',
                       is_blocked = 1
                 WHERE status = 'BLOCKED'
                """);
        if (blocked > 0) {
            log.info("CreditLimitStatusConstraintFix: migrated {} BLOCKED statuses to SUSPENDED", blocked);
        }

        int inactive = jdbcTemplate.update("""
                UPDATE dbo.credit_limits
                   SET status = 'CLOSED',
                       credit_limit = 0,
                       is_blocked = 0
                 WHERE status = 'INACTIVE'
                """);
        if (inactive > 0) {
            log.info("CreditLimitStatusConstraintFix: migrated {} INACTIVE statuses to CLOSED", inactive);
        }

        int repaired = jdbcTemplate.update("""
                UPDATE dbo.credit_limits
                   SET status = CASE WHEN is_blocked = 1 THEN 'SUSPENDED' ELSE 'ACTIVE' END
                 WHERE status NOT IN ('ACTIVE', 'SUSPENDED', 'CLOSED')
                """);
        if (repaired > 0) {
            log.warn("CreditLimitStatusConstraintFix: repaired {} unsupported credit limit statuses", repaired);
        }
    }

    private void ensureNewConstraintExists() {
        Integer count = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM sys.check_constraints WHERE name = ? AND parent_object_id = OBJECT_ID('dbo.credit_limits')",
                Integer.class,
                NEW_CONSTRAINT_NAME);
        if (count != null && count > 0) {
            log.debug("CreditLimitStatusConstraintFix: new constraint already exists, skipping");
            return;
        }

        jdbcTemplate.execute("""
                ALTER TABLE dbo.credit_limits
                ADD CONSTRAINT CK_credit_limits_status_flow
                CHECK (status IN ('ACTIVE', 'SUSPENDED', 'CLOSED'))
                """);
        log.info("CreditLimitStatusConstraintFix: created new constraint '{}'", NEW_CONSTRAINT_NAME);
    }
}
