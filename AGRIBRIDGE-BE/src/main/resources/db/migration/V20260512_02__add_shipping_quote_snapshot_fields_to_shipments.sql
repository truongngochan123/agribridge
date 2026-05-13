IF COL_LENGTH('shipments', 'weight') IS NULL
BEGIN
    ALTER TABLE shipments ADD weight INT NULL;
END;

IF COL_LENGTH('shipments', 'length') IS NULL
BEGIN
    ALTER TABLE shipments ADD length INT NULL;
END;

IF COL_LENGTH('shipments', 'width') IS NULL
BEGIN
    ALTER TABLE shipments ADD width INT NULL;
END;

IF COL_LENGTH('shipments', 'height') IS NULL
BEGIN
    ALTER TABLE shipments ADD height INT NULL;
END;

IF COL_LENGTH('shipments', 'shop_id_used') IS NULL
BEGIN
    ALTER TABLE shipments ADD shop_id_used VARCHAR(255) NULL;
END;

IF COL_LENGTH('shipments', 'from_district_id') IS NULL
BEGIN
    ALTER TABLE shipments ADD from_district_id INT NULL;
END;

IF COL_LENGTH('shipments', 'from_ward_code') IS NULL
BEGIN
    ALTER TABLE shipments ADD from_ward_code VARCHAR(255) NULL;
END;

IF COL_LENGTH('shipments', 'to_district_id') IS NULL
BEGIN
    ALTER TABLE shipments ADD to_district_id INT NULL;
END;

IF COL_LENGTH('shipments', 'to_ward_code') IS NULL
BEGIN
    ALTER TABLE shipments ADD to_ward_code VARCHAR(255) NULL;
END;

IF COL_LENGTH('shipments', 'service_type_id') IS NULL
BEGIN
    ALTER TABLE shipments ADD service_type_id INT NULL;
END;

IF COL_LENGTH('shipments', 'service_id') IS NULL
BEGIN
    ALTER TABLE shipments ADD service_id INT NULL;
END;

IF COL_LENGTH('shipments', 'insurance_value') IS NULL
BEGIN
    ALTER TABLE shipments ADD insurance_value DECIMAL(18, 2) NULL;
END;

IF COL_LENGTH('shipments', 'raw_quote_request') IS NULL
BEGIN
    ALTER TABLE shipments ADD raw_quote_request NVARCHAR(MAX) NULL;
END;

IF COL_LENGTH('shipments', 'raw_quote_response') IS NULL
BEGIN
    ALTER TABLE shipments ADD raw_quote_response NVARCHAR(MAX) NULL;
END;
