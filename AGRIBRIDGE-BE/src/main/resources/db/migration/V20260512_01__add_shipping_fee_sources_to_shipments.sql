IF COL_LENGTH('shipments', 'quoted_shipping_fee') IS NULL
BEGIN
    ALTER TABLE shipments ADD quoted_shipping_fee DECIMAL(18, 2) NULL;
END;

IF COL_LENGTH('shipments', 'ghn_create_fee') IS NULL
BEGIN
    ALTER TABLE shipments ADD ghn_create_fee DECIMAL(18, 2) NULL;
END;

IF COL_LENGTH('shipments', 'sender_address_source') IS NULL
BEGIN
    ALTER TABLE shipments ADD sender_address_source VARCHAR(50) NULL;
END;

IF COL_LENGTH('shipments', 'shipping_fee_source') IS NULL
BEGIN
    ALTER TABLE shipments ADD shipping_fee_source VARCHAR(60) NULL;
END;
