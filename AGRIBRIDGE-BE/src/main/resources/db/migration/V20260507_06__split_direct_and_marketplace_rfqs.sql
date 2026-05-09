-- Split RFQ into explicit Direct and Marketplace flows without replacing existing data.

IF COL_LENGTH('rfqs', 'type') IS NULL
BEGIN
    ALTER TABLE rfqs ADD type VARCHAR(30) NULL;
END;

IF COL_LENGTH('rfqs', 'supplier_company_id') IS NULL
BEGIN
    ALTER TABLE rfqs ADD supplier_company_id BIGINT NULL;
END;

IF COL_LENGTH('rfqs', 'product_name') IS NULL
BEGIN
    ALTER TABLE rfqs ADD product_name NVARCHAR(255) NULL;
END;

IF COL_LENGTH('rfqs', 'updated_at') IS NULL
BEGIN
    ALTER TABLE rfqs ADD updated_at DATETIME2 NULL;
END;

UPDATE r
SET
    r.type = CASE WHEN r.product_id IS NOT NULL THEN 'DIRECT' ELSE 'MARKETPLACE' END,
    r.supplier_company_id = CASE WHEN r.product_id IS NOT NULL THEN p.supplier_company_id ELSE r.supplier_company_id END,
    r.product_name = COALESCE(r.product_name, p.name, r.title),
    r.updated_at = COALESCE(r.updated_at, r.created_at)
FROM rfqs r
LEFT JOIN products p ON p.id = r.product_id
WHERE r.type IS NULL
   OR r.product_name IS NULL
   OR r.updated_at IS NULL
   OR (r.product_id IS NOT NULL AND r.supplier_company_id IS NULL);

UPDATE rfqs SET type = 'MARKETPLACE' WHERE type IS NULL;

ALTER TABLE rfqs ALTER COLUMN type VARCHAR(30) NOT NULL;

IF OBJECT_ID('FK_rfqs_supplier_company', 'F') IS NULL
BEGIN
    ALTER TABLE rfqs ADD CONSTRAINT FK_rfqs_supplier_company FOREIGN KEY (supplier_company_id) REFERENCES companies(id);
END;
