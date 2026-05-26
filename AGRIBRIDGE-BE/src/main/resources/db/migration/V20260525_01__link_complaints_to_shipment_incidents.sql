IF COL_LENGTH('complaints', 'source_type') IS NULL
BEGIN
    ALTER TABLE complaints ADD source_type NVARCHAR(50) NULL;
END;

IF COL_LENGTH('complaints', 'source_id') IS NULL
BEGIN
    ALTER TABLE complaints ADD source_id BIGINT NULL;
END;

IF COL_LENGTH('complaints', 'shipment_id') IS NULL
BEGIN
    ALTER TABLE complaints ADD shipment_id BIGINT NULL;
END;

IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'ux_complaints_source'
      AND object_id = OBJECT_ID('complaints')
)
BEGIN
    CREATE UNIQUE INDEX ux_complaints_source
        ON complaints(source_type, source_id)
        WHERE source_type IS NOT NULL AND source_id IS NOT NULL;
END;
