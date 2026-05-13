IF COL_LENGTH('notifications', 'metadata') IS NULL
BEGIN
    ALTER TABLE notifications ADD metadata NVARCHAR(4000) NULL;
END
