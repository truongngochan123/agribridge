package com.agribridge.backend.config;

import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

/**
 * Fixes the CHECK constraint on companies.verification_status at application startup.
 *
 * Root cause: Hibernate ddl-auto:update created a CHECK constraint when the table was
 * first initialized with only the original 4 enum values (PENDING, APPROVED, REJECTED,
 * NEED_MORE_INFO). After adding new enum values for the auto-verification flow
 * (AUTO_APPROVED, PENDING_REVIEW, etc.), INSERT/UPDATE fails with a constraint violation.
 *
 * This component drops the old constraint and recreates it with all 9 allowed values.
 * It is idempotent – safe to run on every startup.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class VerificationStatusConstraintFix {

    private static final String NEW_CONSTRAINT_NAME = "CK_companies_verification_status_v2";

    private final JdbcTemplate jdbcTemplate;

    @PostConstruct
    public void fixVerificationStatusConstraint() {
        try {
            dropOldConstraints();
            ensureNewConstraintExists();
        } catch (Exception ex) {
            // Non-fatal: log and continue. The app can still function; this is a best-effort fix.
            log.error("VerificationStatusConstraintFix: failed to fix constraint – {}", ex.getMessage(), ex);
        }
    }

    private void dropOldConstraints() {
        // Find all CHECK constraints on the verification_status column and drop them
        String findSql = """
                SELECT cc.name
                FROM sys.check_constraints cc
                JOIN sys.columns c
                    ON cc.parent_object_id = c.object_id
                   AND cc.parent_column_id = c.column_id
                WHERE cc.parent_object_id = OBJECT_ID('dbo.companies')
                  AND c.name = 'verification_status'
                """;

        jdbcTemplate.query(findSql, rs -> {
            String constraintName = rs.getString("name");
            try {
                jdbcTemplate.execute(
                        "ALTER TABLE dbo.companies DROP CONSTRAINT [" + constraintName + "]");
                log.info("VerificationStatusConstraintFix: dropped old constraint '{}'", constraintName);
            } catch (Exception ex) {
                log.warn("VerificationStatusConstraintFix: could not drop constraint '{}': {}",
                        constraintName, ex.getMessage());
            }
        });
    }

    private void ensureNewConstraintExists() {
        // Check if our new constraint already exists
        Integer count = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM sys.check_constraints WHERE name = ?",
                Integer.class,
                NEW_CONSTRAINT_NAME);

        if (count != null && count > 0) {
            log.debug("VerificationStatusConstraintFix: new constraint already exists, skipping");
            return;
        }

        jdbcTemplate.execute("""
                ALTER TABLE dbo.companies
                ADD CONSTRAINT CK_companies_verification_status_v2
                CHECK (verification_status IN (
                    'PENDING',
                    'APPROVED',
                    'REJECTED',
                    'NEED_MORE_INFO',
                    'DRAFT',
                    'PENDING_REVIEW',
                    'AUTO_APPROVED',
                    'MANUAL_APPROVED',
                    'NEEDS_MORE_INFO'
                ))
                """);
        log.info("VerificationStatusConstraintFix: created new constraint '{}'", NEW_CONSTRAINT_NAME);
    }
}
