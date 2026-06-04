-- Keep SQL Server CHECK constraint on orders.status in sync with OrderStatusEnum.
-- Existing databases may have a generated CK__orders__status__* constraint from older enum values.

DECLARE @constraintName NVARCHAR(128);
DECLARE @sql NVARCHAR(MAX);

DECLARE order_status_constraints CURSOR FOR
SELECT cc.name
FROM sys.check_constraints cc
JOIN sys.tables t ON cc.parent_object_id = t.object_id
JOIN sys.schemas s ON t.schema_id = s.schema_id
WHERE s.name = 'dbo'
  AND t.name = 'orders'
  AND cc.definition LIKE '%[status]%';

OPEN order_status_constraints;
FETCH NEXT FROM order_status_constraints INTO @constraintName;

WHILE @@FETCH_STATUS = 0
BEGIN
    SET @sql = N'ALTER TABLE dbo.orders DROP CONSTRAINT ' + QUOTENAME(@constraintName);
    EXEC sp_executesql @sql;
    FETCH NEXT FROM order_status_constraints INTO @constraintName;
END;

CLOSE order_status_constraints;
DEALLOCATE order_status_constraints;

ALTER TABLE dbo.orders WITH CHECK ADD CONSTRAINT CK_orders_status
    CHECK (status IN (
        'PENDING_SUPPLIER_CONFIRMATION',
        'PENDING',
        'PENDING_PAYMENT',
        'PENDING_DEPOSIT',
        'DEPOSIT_PAID_WAITING_SUPPLIER_CONFIRM',
        'PAID_WAITING_SUPPLIER_CONFIRM',
        'SUPPLIER_CONFIRMED',
        'PREPARING',
        'READY_TO_SHIP',
        'CONFIRMED',
        'SHIPPING',
        'DELIVERED',
        'WAITING_FINAL_PAYMENT',
        'WAITING_BUYER_CONFIRM',
        'COMPLETED',
        'CANCELLED',
        'DISPUTED',
        'REFUND_PENDING',
        'PARTIALLY_REFUNDED',
        'REFUNDED'
    ));
