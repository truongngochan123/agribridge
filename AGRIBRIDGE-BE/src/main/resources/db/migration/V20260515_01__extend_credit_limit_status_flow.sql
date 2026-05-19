UPDATE credit_limits
SET status = CASE WHEN is_blocked = 1 THEN 'SUSPENDED' ELSE 'ACTIVE' END
WHERE status IS NULL;
