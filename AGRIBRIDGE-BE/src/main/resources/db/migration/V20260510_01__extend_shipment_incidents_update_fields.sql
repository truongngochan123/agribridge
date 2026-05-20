-- Thêm cột để lưu thông tin buyer cập nhật sự cố
ALTER TABLE shipment_incidents ADD missing_quantity INT NULL;
ALTER TABLE shipment_incidents ADD damaged_quantity INT NULL;
ALTER TABLE shipment_incidents ADD update_note NVARCHAR(MAX) NULL;
ALTER TABLE shipment_incidents ADD evidence_urls NVARCHAR(MAX) NULL;
ALTER TABLE shipment_incidents ADD updated_at DATETIME2 NULL;
