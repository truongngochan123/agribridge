-- Add ward column, do not drop district to avoid data loss
ALTER TABLE companies ADD ward NVARCHAR(255) NULL;
GO

UPDATE companies
SET ward = district
WHERE ward IS NULL AND district IS NOT NULL;
GO
