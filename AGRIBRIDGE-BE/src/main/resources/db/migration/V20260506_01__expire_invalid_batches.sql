-- Manual SQL Server migration: hide already-expired public batches from buyer-facing flows.
-- Flyway is not enabled in this project, so run this script manually if the startup job is disabled.

DECLARE @constraintName NVARCHAR(200)
DECLARE cur CURSOR FOR
    SELECT cc.name
    FROM sys.check_constraints cc
    JOIN sys.columns c
        ON cc.parent_object_id = c.object_id
       AND cc.parent_column_id = c.column_id
    WHERE cc.parent_object_id = OBJECT_ID('dbo.batches')
      AND c.name = 'status'

OPEN cur
FETCH NEXT FROM cur INTO @constraintName
WHILE @@FETCH_STATUS = 0
BEGIN
    EXEC('ALTER TABLE dbo.batches DROP CONSTRAINT [' + @constraintName + ']')
    FETCH NEXT FROM cur INTO @constraintName
END
CLOSE cur
DEALLOCATE cur

ALTER TABLE dbo.batches
    ADD CONSTRAINT CK_batches_status_v2
    CHECK (status IN (
        'DRAFT',
        'AVAILABLE',
        'LOW_STOCK',
        'RESERVED',
        'EXPIRED',
        'DISPOSED',
        'HANDLED',
        'SOLD_OUT'
    ));

IF OBJECT_ID('dbo.batch_expiry_audits', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.batch_expiry_audits (
        id BIGINT IDENTITY(1,1) PRIMARY KEY,
        batch_id BIGINT NOT NULL,
        old_expiry_date DATE NULL,
        new_expiry_date DATE NULL,
        changed_by_user_id BIGINT NULL,
        reason NVARCHAR(1000) NULL,
        changed_at DATETIME2 NOT NULL,
        approved_by_user_id BIGINT NULL
    )
END

UPDATE dbo.batches
SET status = 'EXPIRED'
WHERE expiry_date < CAST(GETDATE() AS date)
  AND status IN ('AVAILABLE', 'LOW_STOCK');
