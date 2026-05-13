-- V20260511_02: Backfill district for existing demo/seed data
-- Supplier data previously mapped from Gia Lai (post-merge) to Bình Định
-- needs district set to "Thành phố Quy Nhơn" for GHN to resolve correctly.

UPDATE companies
SET district = N'Thành phố Quy Nhơn'
WHERE province IN (N'Bình Định', N'Tỉnh Bình Định')
  AND (ward LIKE N'%Quy Nhơn%' OR address LIKE N'%Quy Nhơn%')
  AND district IS NULL;

-- Backfill delivery_district on orders where province is known
-- Only update orders that have delivery_province set but no delivery_district
UPDATE orders
SET delivery_district = N'Thành phố Quy Nhơn'
WHERE delivery_province IN (N'Bình Định', N'Tỉnh Bình Định')
  AND (delivery_ward LIKE N'%Quy Nhơn%' OR delivery_address LIKE N'%Quy Nhơn%')
  AND delivery_district IS NULL;
