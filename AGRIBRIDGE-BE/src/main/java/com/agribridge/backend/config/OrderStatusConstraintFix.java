package com.agribridge.backend.config;

import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

/**
 * Keeps the SQL Server CHECK constraint on orders.status in sync with OrderStatusEnum.
 * Existing local DBs can keep Hibernate-generated CK__orders__status__* constraints
 * that do not include the escrow demo statuses.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class OrderStatusConstraintFix {

    private static final String NEW_CONSTRAINT_NAME = "CK_orders_status_v2";

    private final JdbcTemplate jdbcTemplate;

    @PostConstruct
    public void fixOrderStatusConstraint() {
        try {
            dropOldConstraints();
            ensureNewConstraintExists();
        } catch (Exception ex) {
            log.error("OrderStatusConstraintFix: failed to fix constraint - {}", ex.getMessage(), ex);
        }
    }

    private void dropOldConstraints() {
        String findSql = """
                SELECT cc.name
                FROM sys.check_constraints cc
                JOIN sys.columns c
                    ON cc.parent_object_id = c.object_id
                   AND cc.parent_column_id = c.column_id
                WHERE cc.parent_object_id = OBJECT_ID('dbo.orders')
                  AND c.name = 'status'
                """;

        jdbcTemplate.query(findSql, rs -> {
            String constraintName = rs.getString("name");
            try {
                jdbcTemplate.execute("ALTER TABLE dbo.orders DROP CONSTRAINT [" + constraintName + "]");
                log.info("OrderStatusConstraintFix: dropped old constraint '{}'", constraintName);
            } catch (Exception ex) {
                log.warn("OrderStatusConstraintFix: could not drop constraint '{}': {}",
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
            log.debug("OrderStatusConstraintFix: new constraint already exists, skipping");
            return;
        }

        jdbcTemplate.execute("""
                ALTER TABLE dbo.orders
                ADD CONSTRAINT CK_orders_status_v2
                CHECK (status IN (
                    'PENDING_SUPPLIER_CONFIRMATION',
                    'PENDING',
                    'PENDING_PAYMENT',
                    'PENDING_DEPOSIT',
                    'DEPOSIT_PAID_WAITING_SUPPLIER_CONFIRM',
                    'PAID_WAITING_SUPPLIER_CONFIRM',
                    'SUPPLIER_CONFIRMED',
                    'PREPARING',
                    'READY_TO_SHIP',
                    'CONFIRMED',
                    'SHIPPING',
                    'DELIVERED',
                    'WAITING_FINAL_PAYMENT',
                    'WAITING_BUYER_CONFIRM',
                    'COMPLETED',
                    'CANCELLED',
                    'DISPUTED',
                    'REFUND_PENDING',
                    'PARTIALLY_REFUNDED',
                    'REFUNDED'
                ))
                """);
        log.info("OrderStatusConstraintFix: created new constraint '{}'", NEW_CONSTRAINT_NAME);
    }
}
