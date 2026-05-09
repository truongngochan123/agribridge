IF COL_LENGTH('categories', 'user_id') IS NULL
BEGIN
    ALTER TABLE categories ADD user_id BIGINT NULL;
END;

IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'UX_categories_user_name'
      AND object_id = OBJECT_ID('categories')
)
BEGIN
    CREATE UNIQUE INDEX UX_categories_user_name
        ON categories (user_id, name)
        WHERE user_id IS NOT NULL;
END;

IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'UX_categories_global_name'
      AND object_id = OBJECT_ID('categories')
)
BEGIN
    CREATE UNIQUE INDEX UX_categories_global_name
        ON categories (name)
        WHERE user_id IS NULL;
END;
