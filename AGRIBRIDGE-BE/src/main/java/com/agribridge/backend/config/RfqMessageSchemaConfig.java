package com.agribridge.backend.config;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.jdbc.core.JdbcTemplate;

@Configuration
@RequiredArgsConstructor
@Slf4j
public class RfqMessageSchemaConfig {

    private final JdbcTemplate jdbcTemplate;

    @Bean
    public CommandLineRunner ensureRfqMessageTable() {
        return args -> {
            jdbcTemplate.execute("""
                    IF OBJECT_ID(N'dbo.rfq_messages', N'U') IS NULL
                    BEGIN
                        CREATE TABLE dbo.rfq_messages (
                          id BIGINT IDENTITY(1,1) PRIMARY KEY,
                          rfq_id BIGINT NOT NULL,
                          supplier_company_id BIGINT NULL,
                          sender_user_id BIGINT NOT NULL,
                          sender_company_id BIGINT NOT NULL,
                          sender_role NVARCHAR(20) NOT NULL,
                          message NVARCHAR(MAX) NOT NULL,
                          created_at DATETIME2 NOT NULL DEFAULT GETDATE()
                        )
                    END
                    """);
            jdbcTemplate.execute("""
                    IF COL_LENGTH('dbo.rfq_messages', 'supplier_company_id') IS NULL
                    BEGIN
                        ALTER TABLE dbo.rfq_messages ADD supplier_company_id BIGINT NULL
                    END
                    """);
            log.info("RFQ message table is ready");
        };
    }
}
