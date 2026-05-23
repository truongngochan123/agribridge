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
public class WalletSchemaConfig {

    private final JdbcTemplate jdbcTemplate;

    @Bean
    public CommandLineRunner ensureWithdrawalFeeColumns() {
        return args -> {
            if (!isSqlServer()) {
                return;
            }

            jdbcTemplate.execute("""
                    IF OBJECT_ID(N'dbo.withdrawal_requests', N'U') IS NOT NULL
                    BEGIN
                        IF COL_LENGTH(N'dbo.withdrawal_requests', N'fee_amount') IS NULL
                        BEGIN
                            ALTER TABLE dbo.withdrawal_requests ADD fee_amount DECIMAL(18, 2) NULL;
                        END;

                        IF COL_LENGTH(N'dbo.withdrawal_requests', N'payout_amount') IS NULL
                        BEGIN
                            ALTER TABLE dbo.withdrawal_requests ADD payout_amount DECIMAL(18, 2) NULL;
                        END;

                        UPDATE dbo.withdrawal_requests
                        SET
                            fee_amount = COALESCE(fee_amount, 0),
                            payout_amount = COALESCE(payout_amount, amount - COALESCE(fee_amount, 0))
                        WHERE fee_amount IS NULL
                           OR payout_amount IS NULL;

                        ALTER TABLE dbo.withdrawal_requests ALTER COLUMN fee_amount DECIMAL(18, 2) NOT NULL;
                        ALTER TABLE dbo.withdrawal_requests ALTER COLUMN payout_amount DECIMAL(18, 2) NOT NULL;
                    END
                    """);
            log.info("Wallet withdrawal fee schema migration is ready");
        };
    }

    private boolean isSqlServer() {
        try {
            String productName = Objects.requireNonNull(jdbcTemplate.execute(
                    (@NonNull Connection connection) -> connection.getMetaData().getDatabaseProductName()));
            return productName.toLowerCase(Locale.ROOT).contains("sql server");
        } catch (DataAccessException exception) {
            log.warn("Cannot detect database product for wallet schema migration", exception);
            return false;
        } catch (NullPointerException exception) {
            log.warn("Database product name is unavailable for wallet schema migration");
            return false;
        }
    }
}
