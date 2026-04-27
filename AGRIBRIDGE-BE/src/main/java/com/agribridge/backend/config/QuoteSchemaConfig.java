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
public class QuoteSchemaConfig {

    private final JdbcTemplate jdbcTemplate;

    @Bean
    public CommandLineRunner ensureQuoteBatchIdNullable() {
        return args -> {
            if (!isSqlServer()) {
                return;
            }
            jdbcTemplate.execute("""
                    IF COL_LENGTH(N'dbo.quotes', N'batch_id') IS NOT NULL
                       AND EXISTS (
                         SELECT 1
                         FROM sys.columns c
                         JOIN sys.tables t ON c.object_id = t.object_id
                         JOIN sys.schemas s ON t.schema_id = s.schema_id
                         WHERE s.name = N'dbo'
                           AND t.name = N'quotes'
                           AND c.name = N'batch_id'
                           AND c.is_nullable = 0
                       )
                    BEGIN
                        ALTER TABLE dbo.quotes ALTER COLUMN batch_id BIGINT NULL
                    END
                    """);
            log.info("Quote batch_id nullable migration is ready");
        };
    }

    private boolean isSqlServer() {
        try {
            String productName = Objects.requireNonNull(jdbcTemplate.execute(
                    (@NonNull Connection connection) -> connection.getMetaData().getDatabaseProductName()));
            return productName.toLowerCase(Locale.ROOT).contains("sql server");
        } catch (DataAccessException exception) {
            log.warn("Cannot detect database product for quote schema migration", exception);
            return false;
        } catch (NullPointerException exception) {
            log.warn("Database product name is unavailable for quote schema migration");
            return false;
        }
    }
}
