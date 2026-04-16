package com.agribridge.backend.config;

import java.sql.Connection;
import java.util.List;
import java.util.Locale;
import java.util.Objects;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.lang.NonNull;

@Configuration
@RequiredArgsConstructor
@Slf4j
public class SqlServerUnicodeMigrationConfig {

    private final JdbcTemplate jdbcTemplate;

    @Value("${app.database.unicode-migration.enabled:true}")
    private boolean unicodeMigrationEnabled;

    @Bean
    public CommandLineRunner ensureSqlServerUnicodeColumns() {
        return args -> {
            if (!unicodeMigrationEnabled) {
                log.info("SQL Server unicode migration is disabled");
                return;
            }

            if (!isSqlServer()) {
                return;
            }

            List<ColumnDefinition> columns = jdbcTemplate.query(
                    """
                    SELECT
                        s.name AS schema_name,
                        t.name AS table_name,
                        c.name AS column_name,
                        ty.name AS type_name,
                        c.max_length AS max_length,
                        c.is_nullable AS is_nullable
                    FROM sys.columns c
                    JOIN sys.tables t ON c.object_id = t.object_id
                    JOIN sys.schemas s ON t.schema_id = s.schema_id
                    JOIN sys.types ty ON c.user_type_id = ty.user_type_id
                    WHERE t.is_ms_shipped = 0
                      AND c.is_computed = 0
                      AND ty.name IN ('varchar', 'char', 'text')
                    ORDER BY s.name, t.name, c.column_id
                    """,
                    (rs, rowNum) -> new ColumnDefinition(
                            Objects.requireNonNull(rs.getString("schema_name")),
                            Objects.requireNonNull(rs.getString("table_name")),
                            Objects.requireNonNull(rs.getString("column_name")),
                            Objects.requireNonNull(rs.getString("type_name")),
                            rs.getInt("max_length"),
                            rs.getBoolean("is_nullable")));

            if (columns.isEmpty()) {
                log.info("All SQL Server text columns are already unicode-safe");
                return;
            }

            int converted = 0;
            for (ColumnDefinition column : columns) {
                try {
                    jdbcTemplate.execute(column.toAlterSql());
                    converted++;
                } catch (DataAccessException exception) {
                    log.warn(
                            "Cannot convert column {}.{}.{} to unicode",
                            column.schemaName(),
                            column.tableName(),
                            column.columnName(),
                            exception);
                }
            }

            log.info("SQL Server unicode migration finished. Converted {} column(s)", converted);
        };
    }

    private boolean isSqlServer() {
        try {
            String productName = Objects.requireNonNull(jdbcTemplate.execute(
                    (@NonNull Connection connection) -> connection.getMetaData().getDatabaseProductName()));
            return productName.toLowerCase(Locale.ROOT).contains("sql server");
        } catch (DataAccessException exception) {
            log.warn("Cannot detect database product for unicode migration", exception);
            return false;
        } catch (NullPointerException exception) {
            log.warn("Database product name is unavailable for unicode migration");
            return false;
        }
    }

    private record ColumnDefinition(
            @NonNull String schemaName,
            @NonNull String tableName,
            @NonNull String columnName,
            @NonNull String typeName,
            int maxLength,
            boolean nullable) {

        private @NonNull String toAlterSql() {
            return "ALTER TABLE " + qualify(schemaName, tableName)
                    + " ALTER COLUMN " + quote(columnName)
                    + " " + targetType()
                    + " " + (nullable ? "NULL" : "NOT NULL");
        }

        private @NonNull String targetType() {
            return switch (typeName.toLowerCase(Locale.ROOT)) {
                case "text" -> "nvarchar(max)";
                case "char" -> "nchar(" + maxLength + ")";
                case "varchar" -> maxLength < 0 ? "nvarchar(max)" : "nvarchar(" + maxLength + ")";
                default -> throw new IllegalStateException("Unsupported SQL Server text type: " + typeName);
            };
        }

        private static @NonNull String qualify(@NonNull String schemaName, @NonNull String tableName) {
            return quote(schemaName) + "." + quote(tableName);
        }

        private static @NonNull String quote(@NonNull String identifier) {
            return "[" + identifier.replace("]", "]]") + "]";
        }
    }
}
