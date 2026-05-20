IF COL_LENGTH('shipments', 'auto_progress_enabled') IS NULL
BEGIN
    ALTER TABLE shipments ADD auto_progress_enabled BIT NOT NULL CONSTRAINT DF_shipments_auto_progress_enabled DEFAULT 0;
END;

IF COL_LENGTH('shipments', 'demo_tracking_enabled') IS NULL
BEGIN
    ALTER TABLE shipments ADD demo_tracking_enabled BIT NOT NULL CONSTRAINT DF_shipments_demo_tracking_enabled DEFAULT 0;
END;

IF COL_LENGTH('shipments', 'last_status_changed_at') IS NULL
BEGIN
    ALTER TABLE shipments ADD last_status_changed_at DATETIME2 NULL;
END;

IF COL_LENGTH('shipments', 'progress') IS NULL
BEGIN
    ALTER TABLE shipments ADD progress INT NULL;
END;

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

ALTER TABLE dbo.shipments WITH CHECK ADD CONSTRAINT CK_shipments_status_v3
    CHECK (status IN (
        'CREATED',
        'PENDING',
        'WAITING_PICKUP',
        'PICKED_UP',
        'SHIPPED',
        'IN_TRANSIT',
        'OUT_FOR_DELIVERY',
        'WAITING_CONFIRMATION',
        'CANCELLED',
        'PREPARING',
        'SHIPPING',
        'DELIVERED',
        'INCIDENT',
        'FAILED',
        'FAILED_DELIVERY'
    ));
