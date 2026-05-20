DECLARE @constraintName SYSNAME;
DECLARE @dropSql NVARCHAR(MAX);

DECLARE user_status_constraints CURSOR LOCAL FAST_FORWARD FOR
    SELECT cc.name
    FROM sys.check_constraints cc
    WHERE cc.parent_object_id = OBJECT_ID('dbo.users')
      AND (
            cc.definition LIKE '%status%'
         OR cc.definition LIKE '%[status]%'
      );

OPEN user_status_constraints;
FETCH NEXT FROM user_status_constraints INTO @constraintName;

WHILE @@FETCH_STATUS = 0
BEGIN
    SET @dropSql = N'ALTER TABLE dbo.users DROP CONSTRAINT [' + @constraintName + N']';
    EXEC sp_executesql @dropSql;
    FETCH NEXT FROM user_status_constraints INTO @constraintName;
END

CLOSE user_status_constraints;
DEALLOCATE user_status_constraints;

IF NOT EXISTS (
    SELECT 1
    FROM sys.check_constraints
    WHERE name = 'CK_users_status_invite_flow'
      AND parent_object_id = OBJECT_ID('dbo.users')
)
BEGIN
    ALTER TABLE dbo.users
    ADD CONSTRAINT CK_users_status_invite_flow
    CHECK (status IN ('ACTIVE', 'PENDING_INVITE', 'BLOCKED', 'LOCKED'));
END
