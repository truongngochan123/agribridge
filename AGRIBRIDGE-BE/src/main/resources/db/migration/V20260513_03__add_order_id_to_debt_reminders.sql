IF COL_LENGTH('debt_reminders', 'order_id') IS NULL
BEGIN
    ALTER TABLE debt_reminders ADD order_id BIGINT NULL;
END
