IF COL_LENGTH('credit_limits', 'status') IS NULL
BEGIN
    ALTER TABLE credit_limits ADD status VARCHAR(30) NULL;
END

IF COL_LENGTH('credit_limits', 'note') IS NULL
BEGIN
    ALTER TABLE credit_limits ADD note NVARCHAR(1000) NULL;
END

IF COL_LENGTH('credit_limits', 'updated_at') IS NULL
BEGIN
    ALTER TABLE credit_limits ADD updated_at DATETIME2 NULL;
END

UPDATE credit_limits
SET status = CASE WHEN is_blocked = 1 THEN 'SUSPENDED' ELSE 'ACTIVE' END
WHERE status IS NULL;

IF OBJECT_ID('invoice_items', 'U') IS NULL
BEGIN
    CREATE TABLE invoice_items (
        id BIGINT IDENTITY(1,1) PRIMARY KEY,
        invoice_id BIGINT NOT NULL,
        order_item_id BIGINT NULL,
        product_id BIGINT NULL,
        description NVARCHAR(500) NULL,
        quantity DECIMAL(18, 2) NOT NULL,
        unit NVARCHAR(50) NULL,
        unit_price DECIMAL(18, 2) NOT NULL,
        line_total DECIMAL(18, 2) NOT NULL
    );
END

IF OBJECT_ID('payment_allocations', 'U') IS NULL
BEGIN
    CREATE TABLE payment_allocations (
        id BIGINT IDENTITY(1,1) PRIMARY KEY,
        payment_id BIGINT NOT NULL,
        invoice_id BIGINT NOT NULL,
        amount DECIMAL(18, 2) NOT NULL,
        created_at DATETIME2 NOT NULL
    );
END

IF OBJECT_ID('debt_reminders', 'U') IS NULL
BEGIN
    CREATE TABLE debt_reminders (
        id BIGINT IDENTITY(1,1) PRIMARY KEY,
        invoice_id BIGINT NULL,
        supplier_company_id BIGINT NOT NULL,
        buyer_company_id BIGINT NOT NULL,
        amount DECIMAL(18, 2) NOT NULL,
        message NVARCHAR(1000) NULL,
        channel VARCHAR(50) NULL,
        status VARCHAR(30) NOT NULL,
        created_by_user_id BIGINT NOT NULL,
        sent_at DATETIME2 NULL,
        created_at DATETIME2 NOT NULL
    );
END
