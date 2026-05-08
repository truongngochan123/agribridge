-- Keep SQL Server CHECK constraint on shipments.status in sync with ShipmentStatusEnum.
-- Existing databases may have a generated CK__shipments__statu__* constraint from older enum values.

DECLARE @constraintName NVARCHAR(128);
DECLARE @sql NVARCHAR(MAX);

DECLARE shipment_status_constraints CURSOR FOR
SELECT cc.name
FROM sys.check_constraints cc
JOIN sys.tables t ON cc.parent_object_id = t.object_id
JOIN sys.schemas s ON t.schema_id = s.schema_id
WHERE s.name = 'dbo'
  AND t.name = 'shipments'
  AND cc.definition LIKE '%[status]%';

OPEN shipment_status_constraints;
FETCH NEXT FROM shipment_status_constraints INTO @constraintName;

WHILE @@FETCH_STATUS = 0
BEGIN
    SET @sql = N'ALTER TABLE dbo.shipments DROP CONSTRAINT ' + QUOTENAME(@constraintName);
    EXEC sp_executesql @sql;
    FETCH NEXT FROM shipment_status_constraints INTO @constraintName;
END;

CLOSE shipment_status_constraints;
DEALLOCATE shipment_status_constraints;

ALTER TABLE dbo.shipments WITH CHECK ADD CONSTRAINT CK_shipments_status_v2
    CHECK (status IN (
        'CREATED',
        'PENDING',
        'SHIPPED',
        'IN_TRANSIT',
        'WAITING_CONFIRMATION',
        'CANCELLED',
        'PREPARING',
        'SHIPPING',
        'DELIVERED',
        'INCIDENT',
        'FAILED',
        'FAILED_DELIVERY'
    ));
