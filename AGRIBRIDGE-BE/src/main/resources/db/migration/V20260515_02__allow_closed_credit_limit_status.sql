IF COL_LENGTH('dbo.credit_limits', 'status') IS NULL
BEGIN
    ALTER TABLE dbo.credit_limits ADD status VARCHAR(30) NULL;
END

UPDATE dbo.credit_limits
SET status = CASE WHEN is_blocked = 1 THEN 'SUSPENDED' ELSE 'ACTIVE' END
WHERE status IS NULL;

DECLARE @constraintName SYSNAME;
DECLARE @dropSql NVARCHAR(MAX);

DECLARE credit_limit_status_constraints CURSOR LOCAL FAST_FORWARD FOR
    SELECT cc.name
    FROM sys.check_constraints cc
    WHERE cc.parent_object_id = OBJECT_ID('dbo.credit_limits')
      AND (
            cc.definition LIKE '%status%'
         OR cc.definition LIKE '%[status]%'
      );

OPEN credit_limit_status_constraints;
FETCH NEXT FROM credit_limit_status_constraints INTO @constraintName;

WHILE @@FETCH_STATUS = 0
BEGIN
    SET @dropSql = N'ALTER TABLE dbo.credit_limits DROP CONSTRAINT [' + @constraintName + N']';
    EXEC sp_executesql @dropSql;
    FETCH NEXT FROM credit_limit_status_constraints INTO @constraintName;
END

CLOSE credit_limit_status_constraints;
DEALLOCATE credit_limit_status_constraints;

IF NOT EXISTS (
    SELECT 1
    FROM sys.check_constraints
    WHERE name = 'CK_credit_limits_status_flow'
      AND parent_object_id = OBJECT_ID('dbo.credit_limits')
)
BEGIN
    ALTER TABLE dbo.credit_limits
    ADD CONSTRAINT CK_credit_limits_status_flow
    CHECK (status IS NULL OR status IN ('ACTIVE', 'SUSPENDED', 'CLOSED'));
END
