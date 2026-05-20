ALTER TABLE shipments
ADD ghn_order_code VARCHAR(255) NULL,
    ghn_sort_code VARCHAR(255) NULL,
    ghn_trans_type VARCHAR(255) NULL,
    ghn_raw_response NVARCHAR(MAX) NULL;
