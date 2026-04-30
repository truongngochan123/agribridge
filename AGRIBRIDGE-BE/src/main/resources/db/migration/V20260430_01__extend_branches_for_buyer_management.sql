IF COL_LENGTH('branches', 'district') IS NULL
BEGIN
    ALTER TABLE branches ADD district NVARCHAR(255) NULL;
END;

IF COL_LENGTH('branches', 'ward') IS NULL
BEGIN
    ALTER TABLE branches ADD ward NVARCHAR(255) NULL;
END;

IF COL_LENGTH('branches', 'updated_at') IS NULL
BEGIN
    ALTER TABLE branches ADD updated_at DATETIME2 NULL;
END;

IF COL_LENGTH('branches', 'manager_user_id') IS NULL
BEGIN
    ALTER TABLE branches ADD manager_user_id BIGINT NULL;
    ALTER TABLE branches ADD CONSTRAINT fk_branches_manager_user FOREIGN KEY (manager_user_id) REFERENCES users(id);
END;
