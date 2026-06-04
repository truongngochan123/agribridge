IF COL_LENGTH('complaints', 'decision_type') IS NULL
BEGIN
    ALTER TABLE complaints ADD decision_type NVARCHAR(80) NULL;
END;

IF COL_LENGTH('complaints', 'refund_amount') IS NULL
BEGIN
    ALTER TABLE complaints ADD refund_amount DECIMAL(18, 2) NULL;
END;

IF COL_LENGTH('complaints', 'compensation_amount') IS NULL
BEGIN
    ALTER TABLE complaints ADD compensation_amount DECIMAL(18, 2) NULL;
END;

IF COL_LENGTH('complaints', 'resolved_by_user_id') IS NULL
BEGIN
    ALTER TABLE complaints ADD resolved_by_user_id BIGINT NULL;
END;

IF COL_LENGTH('shipments', 'parent_shipment_id') IS NULL
BEGIN
    ALTER TABLE shipments ADD parent_shipment_id BIGINT NULL;
END;

IF COL_LENGTH('shipments', 'shipment_type') IS NULL
BEGIN
    ALTER TABLE shipments ADD shipment_type NVARCHAR(50) NULL;
END;

IF COL_LENGTH('shipments', 'replacement_incident_id') IS NULL
BEGIN
    ALTER TABLE shipments ADD replacement_incident_id BIGINT NULL;
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

ALTER TABLE dbo.shipments WITH CHECK ADD CONSTRAINT CK_shipments_status_v4
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
        'WAITING_REPLACEMENT',
        'FAILED',
        'FAILED_DELIVERY'
    ));
