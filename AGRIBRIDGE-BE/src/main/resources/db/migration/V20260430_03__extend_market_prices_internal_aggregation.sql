IF COL_LENGTH('market_prices', 'product_type_id') IS NULL
BEGIN
    ALTER TABLE market_prices ADD product_type_id BIGINT NULL;
END;

IF COL_LENGTH('market_prices', 'product_type_name') IS NULL
BEGIN
    ALTER TABLE market_prices ADD product_type_name NVARCHAR(255) NULL;
END;

IF COL_LENGTH('market_prices', 'normalized_product_name') IS NULL
BEGIN
    ALTER TABLE market_prices ADD normalized_product_name NVARCHAR(255) NULL;
END;

IF COL_LENGTH('market_prices', 'category_id') IS NULL
BEGIN
    ALTER TABLE market_prices ADD category_id BIGINT NULL;
END;

IF COL_LENGTH('market_prices', 'source_type') IS NULL
BEGIN
    ALTER TABLE market_prices ADD source_type VARCHAR(50) NULL;
END;

IF COL_LENGTH('market_prices', 'source_name') IS NULL
BEGIN
    ALTER TABLE market_prices ADD source_name NVARCHAR(255) NULL;
END;

IF COL_LENGTH('market_prices', 'unit') IS NULL
BEGIN
    ALTER TABLE market_prices ADD unit NVARCHAR(50) NULL;
END;

IF COL_LENGTH('market_prices', 'sample_count') IS NULL
BEGIN
    ALTER TABLE market_prices ADD sample_count INT NULL;
END;

IF COL_LENGTH('market_prices', 'supplier_count') IS NULL
BEGIN
    ALTER TABLE market_prices ADD supplier_count INT NULL;
END;

IF COL_LENGTH('market_prices', 'updated_at') IS NULL
BEGIN
    ALTER TABLE market_prices ADD updated_at DATETIME2(6) NULL;
END;
