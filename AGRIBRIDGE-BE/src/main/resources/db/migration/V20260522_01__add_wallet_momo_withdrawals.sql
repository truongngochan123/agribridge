IF OBJECT_ID('wallet_accounts', 'U') IS NULL
BEGIN
    CREATE TABLE wallet_accounts (
        id BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        company_id BIGINT NOT NULL,
        available_balance DECIMAL(18, 2) NOT NULL CONSTRAINT DF_wallet_accounts_available DEFAULT 0,
        pending_balance DECIMAL(18, 2) NOT NULL CONSTRAINT DF_wallet_accounts_pending DEFAULT 0,
        total_earned DECIMAL(18, 2) NOT NULL CONSTRAINT DF_wallet_accounts_earned DEFAULT 0,
        total_withdrawn DECIMAL(18, 2) NOT NULL CONSTRAINT DF_wallet_accounts_withdrawn DEFAULT 0,
        created_at DATETIME2 NOT NULL,
        updated_at DATETIME2 NULL,
        CONSTRAINT FK_wallet_accounts_company FOREIGN KEY (company_id) REFERENCES companies(id)
    );
    CREATE UNIQUE INDEX UX_wallet_accounts_company ON wallet_accounts(company_id);
END;

IF OBJECT_ID('wallet_ledger_entries', 'U') IS NULL
BEGIN
    CREATE TABLE wallet_ledger_entries (
        id BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        wallet_account_id BIGINT NOT NULL,
        company_id BIGINT NOT NULL,
        order_id BIGINT NULL,
        payment_id BIGINT NULL,
        withdrawal_request_id BIGINT NULL,
        entry_type VARCHAR(50) NOT NULL,
        amount DECIMAL(18, 2) NOT NULL,
        balance_after DECIMAL(18, 2) NOT NULL,
        description NVARCHAR(500) NULL,
        created_at DATETIME2 NOT NULL,
        CONSTRAINT FK_wallet_ledger_wallet FOREIGN KEY (wallet_account_id) REFERENCES wallet_accounts(id),
        CONSTRAINT FK_wallet_ledger_company FOREIGN KEY (company_id) REFERENCES companies(id)
    );
    CREATE INDEX IX_wallet_ledger_company_created ON wallet_ledger_entries(company_id, created_at DESC);
END;

IF OBJECT_ID('withdrawal_requests', 'U') IS NULL
BEGIN
    CREATE TABLE withdrawal_requests (
        id BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        supplier_company_id BIGINT NOT NULL,
        amount DECIMAL(18, 2) NOT NULL,
        fee_amount DECIMAL(18, 2) NOT NULL CONSTRAINT DF_withdrawal_fee_amount DEFAULT 0,
        payout_amount DECIMAL(18, 2) NOT NULL CONSTRAINT DF_withdrawal_payout_amount DEFAULT 0,
        bank_name NVARCHAR(255) NULL,
        bank_account_number NVARCHAR(100) NULL,
        bank_account_name NVARCHAR(255) NULL,
        note NVARCHAR(1000) NULL,
        status VARCHAR(30) NOT NULL,
        requested_at DATETIME2 NOT NULL,
        reviewed_at DATETIME2 NULL,
        paid_at DATETIME2 NULL,
        reviewed_by_user_id BIGINT NULL,
        admin_note NVARCHAR(1000) NULL,
        CONSTRAINT FK_withdrawal_supplier FOREIGN KEY (supplier_company_id) REFERENCES companies(id),
        CONSTRAINT FK_withdrawal_reviewer FOREIGN KEY (reviewed_by_user_id) REFERENCES users(id)
    );
    CREATE INDEX IX_withdrawal_supplier_requested ON withdrawal_requests(supplier_company_id, requested_at DESC);
END;

IF OBJECT_ID('momo_payment_attempts', 'U') IS NULL
BEGIN
    CREATE TABLE momo_payment_attempts (
        id BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        payment_id BIGINT NOT NULL,
        order_id BIGINT NULL,
        momo_order_id VARCHAR(100) NOT NULL,
        request_id VARCHAR(100) NOT NULL,
        amount DECIMAL(18, 2) NOT NULL,
        pay_url NVARCHAR(1000) NULL,
        deeplink NVARCHAR(1000) NULL,
        qr_code_url NVARCHAR(1000) NULL,
        result_code INT NULL,
        trans_id VARCHAR(100) NULL,
        status VARCHAR(30) NOT NULL,
        raw_callback NVARCHAR(MAX) NULL,
        created_at DATETIME2 NOT NULL,
        updated_at DATETIME2 NULL,
        CONSTRAINT FK_momo_attempt_payment FOREIGN KEY (payment_id) REFERENCES payments(id)
    );
    CREATE UNIQUE INDEX UX_momo_attempt_order ON momo_payment_attempts(momo_order_id);
    CREATE INDEX IX_momo_attempt_payment ON momo_payment_attempts(payment_id, created_at DESC);
END;
