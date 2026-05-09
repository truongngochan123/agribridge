package com.agribridge.backend.config;

import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

/**
 * Keeps the SQL Server CHECK constraint on shipments.status in sync with ShipmentStatusEnum.
 * Hibernate ddl-auto:update does not widen existing CHECK constraints after enum values are added.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class ShipmentStatusConstraintFix {

    private static final String NEW_CONSTRAINT_NAME = "CK_shipments_status_v2";

    private final JdbcTemplate jdbcTemplate;

    @PostConstruct
    public void fixShipmentStatusConstraint() {
        try {
            dropOldConstraints();
            ensureNewConstraintExists();
        } catch (Exception ex) {
            log.error("ShipmentStatusConstraintFix: failed to fix constraint - {}", ex.getMessage(), ex);
        }
    }

    private void dropOldConstraints() {
        String findSql = """
                SELECT cc.name
                FROM sys.check_constraints cc
                JOIN sys.tables t ON cc.parent_object_id = t.object_id
                JOIN sys.schemas s ON t.schema_id = s.schema_id
                WHERE s.name = 'dbo'
                  AND t.name = 'shipments'
                  AND cc.definition LIKE '%[status]%'
                """;

        jdbcTemplate.query(findSql, rs -> {
            String constraintName = rs.getString("name");
            try {
                jdbcTemplate.execute("ALTER TABLE dbo.shipments DROP CONSTRAINT [" + constraintName + "]");
                log.info("ShipmentStatusConstraintFix: dropped old constraint '{}'", constraintName);
            } catch (Exception ex) {
                log.warn("ShipmentStatusConstraintFix: could not drop constraint '{}': {}",
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
            log.debug("ShipmentStatusConstraintFix: new constraint already exists, skipping");
            return;
        }

        jdbcTemplate.execute("""
                ALTER TABLE dbo.shipments
                ADD CONSTRAINT CK_shipments_status_v2
                CHECK (status IN (
                    'CREATED',
                    'PENDING',
                    'SHIPPED',
                    'IN_TRANSIT',
                    'WAITING_CONFIRMATION',
                    'CANCELLED',
                    'PREPARING',
                    'SHIPPING',
                    'DELIVERED',
                    'INCIDENT',
                    'FAILED',
                    'FAILED_DELIVERY'
                ))
                """);
        log.info("ShipmentStatusConstraintFix: created new constraint '{}'", NEW_CONSTRAINT_NAME);
    }
}
