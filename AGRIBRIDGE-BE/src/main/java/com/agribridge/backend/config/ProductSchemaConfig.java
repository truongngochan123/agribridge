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
public class ProductSchemaConfig {

    private final JdbcTemplate jdbcTemplate;

    @Bean
    public CommandLineRunner ensureProductDescriptionMax() {
        return args -> {
            if (!isSqlServer()) {
                return;
            }
            jdbcTemplate.execute("""
                    IF COL_LENGTH(N'dbo.products', N'description') IS NOT NULL
                    BEGIN
                        ALTER TABLE dbo.products ALTER COLUMN description NVARCHAR(MAX) NULL
                    END
                    """);
            log.info("Product description NVARCHAR(MAX) schema migration is ready");
        };
    }

    private boolean isSqlServer() {
        try {
            String productName = Objects.requireNonNull(jdbcTemplate.execute(
                    (@NonNull Connection connection) -> connection.getMetaData().getDatabaseProductName()));
            return productName.toLowerCase(Locale.ROOT).contains("sql server");
        } catch (DataAccessException exception) {
            log.warn("Cannot detect database product for product schema migration", exception);
            return false;
        } catch (NullPointerException exception) {
            log.warn("Database product name is unavailable for product schema migration");
            return false;
        }
    }
}
