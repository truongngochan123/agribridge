package com.agribridge.backend.config;

import java.sql.Connection;
import java.util.Locale;
import java.util.Objects;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.lang.NonNull;

@Configuration
@RequiredArgsConstructor
@Slf4j
public class RfqSchemaConfig {

    private final JdbcTemplate jdbcTemplate;

    @Bean
    public CommandLineRunner ensureRfqMarketplaceColumns() {
        return args -> {
            if (!isSqlServer()) {
                return;
            }

            if (!rfqTableExists()) {
                return;
            }

            jdbcTemplate.execute("""
                    IF COL_LENGTH(N'dbo.rfqs', N'type') IS NULL
                    BEGIN
                        ALTER TABLE dbo.rfqs ADD type VARCHAR(30) NULL;
                    END;

                    IF COL_LENGTH(N'dbo.rfqs', N'supplier_company_id') IS NULL
                    BEGIN
                        ALTER TABLE dbo.rfqs ADD supplier_company_id BIGINT NULL;
                    END;

                    IF COL_LENGTH(N'dbo.rfqs', N'product_name') IS NULL
                    BEGIN
                        ALTER TABLE dbo.rfqs ADD product_name NVARCHAR(255) NULL;
                    END;

                    IF COL_LENGTH(N'dbo.rfqs', N'updated_at') IS NULL
                    BEGIN
                        ALTER TABLE dbo.rfqs ADD updated_at DATETIME2 NULL;
                    END;
                    """);

            if (columnExists("type")) {
                jdbcTemplate.execute("""
                        UPDATE r
                        SET
                            r.type = CASE WHEN r.product_id IS NOT NULL THEN 'DIRECT' ELSE 'MARKETPLACE' END,
                            r.supplier_company_id = CASE WHEN r.product_id IS NOT NULL THEN p.supplier_company_id ELSE r.supplier_company_id END,
                            r.product_name = COALESCE(r.product_name, p.name, r.title),
                            r.updated_at = COALESCE(r.updated_at, r.created_at)
                        FROM dbo.rfqs r
                        LEFT JOIN dbo.products p ON p.id = r.product_id
                        WHERE r.type IS NULL
                           OR r.product_name IS NULL
                           OR r.updated_at IS NULL
                           OR (r.product_id IS NOT NULL AND r.supplier_company_id IS NULL);
                        """);

                jdbcTemplate.execute("UPDATE dbo.rfqs SET type = 'MARKETPLACE' WHERE type IS NULL;");

                if (isColumnNullable("type")) {
                    jdbcTemplate.execute("ALTER TABLE dbo.rfqs ALTER COLUMN type VARCHAR(30) NOT NULL;");
                }
            }

            fixRfqStatusConstraint();
            log.info("RFQ direct/marketplace schema is ready");
        };
    }

    private void fixRfqStatusConstraint() {
        jdbcTemplate.execute("""
                DECLARE @constraintName NVARCHAR(128);
                DECLARE @sql NVARCHAR(MAX);

                DECLARE rfq_status_constraints CURSOR FOR
                SELECT cc.name
                FROM sys.check_constraints cc
                JOIN sys.tables t ON cc.parent_object_id = t.object_id
                JOIN sys.schemas s ON t.schema_id = s.schema_id
                WHERE s.name = 'dbo'
                  AND t.name = 'rfqs'
                  AND cc.definition LIKE '%[status]%';

                OPEN rfq_status_constraints;
                FETCH NEXT FROM rfq_status_constraints INTO @constraintName;

                WHILE @@FETCH_STATUS = 0
                BEGIN
                    SET @sql = N'ALTER TABLE dbo.rfqs DROP CONSTRAINT ' + QUOTENAME(@constraintName);
                    EXEC sp_executesql @sql;
                    FETCH NEXT FROM rfq_status_constraints INTO @constraintName;
                END;

                CLOSE rfq_status_constraints;
                DEALLOCATE rfq_status_constraints;

                IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_rfqs_status_v2')
                BEGIN
                    ALTER TABLE dbo.rfqs
                    ADD CONSTRAINT CK_rfqs_status_v2
                    CHECK (status IN ('OPEN', 'QUOTED', 'ACCEPTED', 'CLOSED', 'CANCELLED'));
                END;
                """);
    }

    private boolean isSqlServer() {
        try {
            String productName = Objects.requireNonNull(jdbcTemplate.execute(
                    (@NonNull Connection connection) -> connection.getMetaData().getDatabaseProductName()));
            return productName.toLowerCase(Locale.ROOT).contains("sql server");
        } catch (DataAccessException exception) {
            log.warn("Cannot detect database product for RFQ schema migration", exception);
            return false;
        } catch (NullPointerException exception) {
            log.warn("Database product name is unavailable for RFQ schema migration");
            return false;
        }
    }

    private boolean rfqTableExists() {
        Integer count = jdbcTemplate.queryForObject("""
                SELECT COUNT(1)
                FROM sys.tables t
                JOIN sys.schemas s ON t.schema_id = s.schema_id
                WHERE s.name = N'dbo'
                  AND t.name = N'rfqs';
                """, Integer.class);
        return count != null && count > 0;
    }

    private boolean columnExists(String columnName) {
        Integer count = jdbcTemplate.queryForObject("""
                SELECT COUNT(1)
                FROM sys.columns c
                JOIN sys.tables t ON c.object_id = t.object_id
                JOIN sys.schemas s ON t.schema_id = s.schema_id
                WHERE s.name = N'dbo'
                  AND t.name = N'rfqs'
                  AND c.name = ?;
                """, Integer.class, columnName);
        return count != null && count > 0;
    }

    private boolean isColumnNullable(String columnName) {
        Integer nullable = jdbcTemplate.queryForObject("""
                SELECT c.is_nullable
                FROM sys.columns c
                JOIN sys.tables t ON c.object_id = t.object_id
                JOIN sys.schemas s ON t.schema_id = s.schema_id
                WHERE s.name = N'dbo'
                  AND t.name = N'rfqs'
                  AND c.name = ?;
                """, Integer.class, columnName);
        return nullable != null && nullable == 1;
    }
}
