-- Fix batch status values that are lowercase instead of UPPERCASE.
-- Root cause: seed data inserted status='available' but Java BatchStatusEnum is case-sensitive.
-- Hibernate throws: No enum constant BatchStatusEnum.available
--
-- SQL Server default collation is case-insensitive so WHERE status != UPPER(status) matches nothing.
-- Must use a case-sensitive collation explicitly.
--
-- Run this SQL manually on the database (Flyway is not used in this project):
UPDATE batches
SET status = UPPER(status)
WHERE status COLLATE Latin1_General_CS_AS != UPPER(status COLLATE Latin1_General_CS_AS);
