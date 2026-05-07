IF COL_LENGTH('orders', 'payment_option') IS NULL
BEGIN
    ALTER TABLE orders ADD payment_option VARCHAR(30) NULL;
END;

IF COL_LENGTH('orders', 'payment_status') IS NULL
BEGIN
    ALTER TABLE orders ADD payment_status VARCHAR(40) NULL;
END;

IF COL_LENGTH('orders', 'escrow_status') IS NULL
BEGIN
    ALTER TABLE orders ADD escrow_status VARCHAR(40) NULL;
END;

IF COL_LENGTH('orders', 'remaining_amount') IS NULL
BEGIN
    ALTER TABLE orders ADD remaining_amount DECIMAL(18, 2) NULL;
END;

IF COL_LENGTH('orders', 'shipping_address_snapshot') IS NULL
BEGIN
    ALTER TABLE orders ADD shipping_address_snapshot NVARCHAR(1000) NULL;
END;

IF COL_LENGTH('orders', 'expected_delivery_date') IS NULL
BEGIN
    ALTER TABLE orders ADD expected_delivery_date DATETIME2 NULL;
END;

IF COL_LENGTH('orders', 'updated_at') IS NULL
BEGIN
    ALTER TABLE orders ADD updated_at DATETIME2 NULL;
END;

IF COL_LENGTH('orders', 'completed_at') IS NULL
BEGIN
    ALTER TABLE orders ADD completed_at DATETIME2 NULL;
END;

IF COL_LENGTH('orders', 'cancelled_at') IS NULL
BEGIN
    ALTER TABLE orders ADD cancelled_at DATETIME2 NULL;
END;

IF COL_LENGTH('payments', 'order_id') IS NULL
BEGIN
    ALTER TABLE payments ADD order_id BIGINT NULL;
END;

IF COL_LENGTH('payments', 'buyer_company_id') IS NULL
BEGIN
    ALTER TABLE payments ADD buyer_company_id BIGINT NULL;
END;

IF COL_LENGTH('payments', 'transfer_content') IS NULL
BEGIN
    ALTER TABLE payments ADD transfer_content VARCHAR(100) NULL;
END;

IF COL_LENGTH('payments', 'proof_image_url') IS NULL
BEGIN
    ALTER TABLE payments ADD proof_image_url NVARCHAR(500) NULL;
END;

IF COL_LENGTH('payments', 'paid_at') IS NULL
BEGIN
    ALTER TABLE payments ADD paid_at DATETIME2 NULL;
END;

IF COL_LENGTH('payments', 'verified_at') IS NULL
BEGIN
    ALTER TABLE payments ADD verified_at DATETIME2 NULL;
END;

IF COL_LENGTH('payments', 'created_at') IS NULL
BEGIN
    ALTER TABLE payments ADD created_at DATETIME2 NULL;
END;

IF COL_LENGTH('payments', 'updated_at') IS NULL
BEGIN
    ALTER TABLE payments ADD updated_at DATETIME2 NULL;
END;

IF COL_LENGTH('shipments', 'expected_delivery_date') IS NULL
BEGIN
    ALTER TABLE shipments ADD expected_delivery_date DATETIME2 NULL;
END;

IF COL_LENGTH('shipments', 'updated_at') IS NULL
BEGIN
    ALTER TABLE shipments ADD updated_at DATETIME2 NULL;
END;

IF OBJECT_ID('escrow_transactions', 'U') IS NULL
BEGIN
    CREATE TABLE escrow_transactions (
        id BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        order_id BIGINT NOT NULL,
        payment_id BIGINT NULL,
        buyer_company_id BIGINT NOT NULL,
        supplier_company_id BIGINT NOT NULL,
        amount DECIMAL(18, 2) NOT NULL,
        transaction_type VARCHAR(20) NOT NULL,
        status VARCHAR(20) NOT NULL,
        description NVARCHAR(500) NULL,
        created_at DATETIME2 NOT NULL,
        CONSTRAINT FK_escrow_transactions_orders FOREIGN KEY (order_id) REFERENCES orders(id),
        CONSTRAINT FK_escrow_transactions_payments FOREIGN KEY (payment_id) REFERENCES payments(id)
    );
END;

IF OBJECT_ID('supplier_payouts', 'U') IS NULL
BEGIN
    CREATE TABLE supplier_payouts (
        id BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        order_id BIGINT NOT NULL,
        supplier_company_id BIGINT NOT NULL,
        amount DECIMAL(18, 2) NOT NULL,
        payout_status VARCHAR(20) NOT NULL,
        transaction_code VARCHAR(100) NULL,
        paid_at DATETIME2 NULL,
        created_at DATETIME2 NOT NULL,
        updated_at DATETIME2 NULL,
        CONSTRAINT FK_supplier_payouts_orders FOREIGN KEY (order_id) REFERENCES orders(id)
    );
END;

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = 'UX_supplier_payouts_order'
      AND object_id = OBJECT_ID('supplier_payouts')
)
BEGIN
    CREATE UNIQUE INDEX UX_supplier_payouts_order ON supplier_payouts(order_id);
END;
