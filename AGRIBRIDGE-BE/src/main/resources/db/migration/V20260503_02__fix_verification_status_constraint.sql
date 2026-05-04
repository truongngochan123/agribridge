-- Migration: fix verification_status CHECK constraint to allow new auto-verification enum values
-- Root cause: Hibernate ddl-auto:update created a CHECK constraint when the table was first created
-- with only the original 4 enum values. New values (AUTO_APPROVED, PENDING_REVIEW, etc.) violate it.

-- Step 1: Drop all CHECK constraints on companies.verification_status (name varies by DB instance)
DECLARE @constraintName NVARCHAR(200)
DECLARE cur CURSOR FOR
    SELECT cc.name
    FROM sys.check_constraints cc
    JOIN sys.columns c
        ON cc.parent_object_id = c.object_id
       AND cc.parent_column_id = c.column_id
    WHERE cc.parent_object_id = OBJECT_ID('dbo.companies')
      AND c.name = 'verification_status'

OPEN cur
FETCH NEXT FROM cur INTO @constraintName
WHILE @@FETCH_STATUS = 0
BEGIN
    EXEC('ALTER TABLE dbo.companies DROP CONSTRAINT [' + @constraintName + ']')
    FETCH NEXT FROM cur INTO @constraintName
END
CLOSE cur
DEALLOCATE cur

-- Step 2: Add new CHECK constraint that includes all valid enum values (old + new)
ALTER TABLE dbo.companies
    ADD CONSTRAINT CK_companies_verification_status
    CHECK (verification_status IN (
        'PENDING',
        'APPROVED',
        'REJECTED',
        'NEED_MORE_INFO',
        'DRAFT',
        'PENDING_REVIEW',
        'AUTO_APPROVED',
        'MANUAL_APPROVED',
        'NEEDS_MORE_INFO'
    ));
