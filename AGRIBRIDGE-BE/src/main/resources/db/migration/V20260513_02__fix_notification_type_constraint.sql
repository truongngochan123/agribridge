-- Keep SQL Server CHECK constraint on notifications.type in sync with NotificationTypeEnum.
-- Existing databases may still have generated CK__notificati__type__* constraints with older enum values.

DECLARE @constraintName NVARCHAR(128);
DECLARE @sql NVARCHAR(MAX);

DECLARE notification_type_constraints CURSOR FOR
SELECT cc.name
FROM sys.check_constraints cc
JOIN sys.tables t ON cc.parent_object_id = t.object_id
JOIN sys.schemas s ON t.schema_id = s.schema_id
WHERE s.name = 'dbo'
  AND t.name = 'notifications'
  AND cc.definition LIKE '%[type]%';

OPEN notification_type_constraints;
FETCH NEXT FROM notification_type_constraints INTO @constraintName;

WHILE @@FETCH_STATUS = 0
BEGIN
    SET @sql = N'ALTER TABLE dbo.notifications DROP CONSTRAINT ' + QUOTENAME(@constraintName);
    EXEC sp_executesql @sql;
    FETCH NEXT FROM notification_type_constraints INTO @constraintName;
END;

CLOSE notification_type_constraints;
DEALLOCATE notification_type_constraints;

ALTER TABLE dbo.notifications WITH CHECK ADD CONSTRAINT CK_notifications_type_v2
    CHECK ([type] IN (
        'ORDER_CREATED_FOR_SUPPLIER',
        'ORDER_CONFIRMED_FOR_BUYER',
        'ORDER_CANCELLED_FOR_BUYER',
        'ORDER_CANCELLED_BY_BUYER_FOR_SUPPLIER',
        'PAYMENT_DEPOSIT_PAID_FOR_SUPPLIER',
        'PAYMENT_REMAINING_PAID_FOR_SUPPLIER',
        'PAYMENT_COMPLETED_FOR_BUYER',
        'PAYMENT_REMAINING_REQUIRED',
        'DELIVERY_IN_TRANSIT_FOR_BUYER',
        'DELIVERY_WAITING_CONFIRMATION_FOR_BUYER',
        'DELIVERY_FAILED',
        'RFQ_CREATED_FOR_SUPPLIER',
        'RFQ_QUOTE_SENT_FOR_BUYER',
        'RFQ_QUOTE_SELECTED_FOR_SUPPLIER',
        'COMPLAINT_CREATED_FOR_SUPPLIER',
        'COMPLAINT_RESPONDED_FOR_BUYER',
        'DEBT_REMINDER',
        'DEBT_CREDIT_LIMIT_GRANTED',
        'PAYMENT_DUE',
        'DEBT_OVERDUE',
        'DEBT_PAYMENT_CONFIRMED',
        'PRICE_ALERT',
        'ORDER_UPDATE',
        'RFQ_RESPONSE',
        'REGISTRATION_APPROVED',
        'REGISTRATION_NEED_MORE_INFO',
        'REGISTRATION_REJECTED',
        'REGISTRATION_REOPENED',
        'SYSTEM'
    ));
