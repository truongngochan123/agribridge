-- Normalize legacy notification type values before the JPA enum reads them.
-- Older demo rows used lower-case values such as order_update, which makes
-- /api/notifications fail before new unread debt reminders can be returned.

DECLARE @allowedTypes TABLE ([type] NVARCHAR(255) PRIMARY KEY);

INSERT INTO @allowedTypes ([type])
VALUES
    ('ORDER_CREATED_FOR_SUPPLIER'),
    ('ORDER_CONFIRMED_FOR_BUYER'),
    ('ORDER_CANCELLED_FOR_BUYER'),
    ('ORDER_CANCELLED_BY_BUYER_FOR_SUPPLIER'),
    ('PAYMENT_DEPOSIT_PAID_FOR_SUPPLIER'),
    ('PAYMENT_REMAINING_PAID_FOR_SUPPLIER'),
    ('PAYMENT_COMPLETED_FOR_BUYER'),
    ('PAYMENT_REMAINING_REQUIRED'),
    ('DELIVERY_IN_TRANSIT_FOR_BUYER'),
    ('DELIVERY_WAITING_CONFIRMATION_FOR_BUYER'),
    ('DELIVERY_FAILED'),
    ('RFQ_CREATED_FOR_SUPPLIER'),
    ('RFQ_QUOTE_SENT_FOR_BUYER'),
    ('RFQ_QUOTE_SELECTED_FOR_SUPPLIER'),
    ('COMPLAINT_CREATED_FOR_SUPPLIER'),
    ('COMPLAINT_RESPONDED_FOR_BUYER'),
    ('DEBT_REMINDER'),
    ('DEBT_CREDIT_LIMIT_GRANTED'),
    ('PAYMENT_DUE'),
    ('DEBT_OVERDUE'),
    ('DEBT_PAYMENT_CONFIRMED'),
    ('PRICE_ALERT'),
    ('ORDER_UPDATE'),
    ('RFQ_RESPONSE'),
    ('REGISTRATION_APPROVED'),
    ('REGISTRATION_NEED_MORE_INFO'),
    ('REGISTRATION_REJECTED'),
    ('REGISTRATION_REOPENED'),
    ('SYSTEM');

UPDATE n
   SET [type] = UPPER(n.[type])
FROM dbo.notifications n
JOIN @allowedTypes allowed ON allowed.[type] = UPPER(n.[type])
WHERE n.[type] COLLATE Latin1_General_CS_AS <> UPPER(n.[type]) COLLATE Latin1_General_CS_AS;

UPDATE n
   SET [type] = 'SYSTEM'
FROM dbo.notifications n
LEFT JOIN @allowedTypes allowed ON allowed.[type] = n.[type]
WHERE n.[type] IS NULL OR allowed.[type] IS NULL;
