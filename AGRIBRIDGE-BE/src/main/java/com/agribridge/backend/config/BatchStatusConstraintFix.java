package com.agribridge.backend.config;

import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

/**
 * Keeps the SQL Server CHECK constraint on batches.status in sync with BatchStatusEnum.
 * Hibernate ddl-auto:update does not widen existing CHECK constraints after enum values
 * are added, so this must run before the expiry startup job writes EXPIRED.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class BatchStatusConstraintFix {

    private static final String NEW_CONSTRAINT_NAME = "CK_batches_status_v2";

    private final JdbcTemplate jdbcTemplate;

    @PostConstruct
    public void fixBatchStatusConstraint() {
        try {
            dropOldConstraints();
            ensureNewConstraintExists();
        } catch (Exception ex) {
            log.error("BatchStatusConstraintFix: failed to fix constraint - {}", ex.getMessage(), ex);
        }
    }

    private void dropOldConstraints() {
        String findSql = """
                SELECT cc.name
                FROM sys.check_constraints cc
                JOIN sys.columns c
                    ON cc.parent_object_id = c.object_id
                   AND cc.parent_column_id = c.column_id
                WHERE cc.parent_object_id = OBJECT_ID('dbo.batches')
                  AND c.name = 'status'
                """;

        jdbcTemplate.query(findSql, rs -> {
            String constraintName = rs.getString("name");
            try {
                jdbcTemplate.execute("ALTER TABLE dbo.batches DROP CONSTRAINT [" + constraintName + "]");
                log.info("BatchStatusConstraintFix: dropped old constraint '{}'", constraintName);
            } catch (Exception ex) {
                log.warn("BatchStatusConstraintFix: could not drop constraint '{}': {}",
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
            log.debug("BatchStatusConstraintFix: new constraint already exists, skipping");
            return;
        }

        jdbcTemplate.execute("""
                ALTER TABLE dbo.batches
                ADD CONSTRAINT CK_batches_status_v2
                CHECK (status IN (
                    'DRAFT',
                    'AVAILABLE',
                    'LOW_STOCK',
                    'RESERVED',
                    'EXPIRED',
                    'DISPOSED',
                    'HANDLED',
                    'SOLD_OUT'
                ))
                """);
        log.info("BatchStatusConstraintFix: created new constraint '{}'", NEW_CONSTRAINT_NAME);
    }
}
