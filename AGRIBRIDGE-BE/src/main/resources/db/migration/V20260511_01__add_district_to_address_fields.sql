-- V20260511_01: Add district field to companies, orders, and shipments
-- for 3-level address model (province + district + ward) required by GHN integration

ALTER TABLE companies ADD district NVARCHAR(200) NULL;

ALTER TABLE orders ADD delivery_district NVARCHAR(200) NULL;

ALTER TABLE shipments ADD receiver_district NVARCHAR(200) NULL;
