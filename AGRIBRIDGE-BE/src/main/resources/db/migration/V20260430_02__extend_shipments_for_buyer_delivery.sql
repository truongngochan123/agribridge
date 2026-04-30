IF COL_LENGTH('shipments', 'estimated_delivery_at') IS NULL
BEGIN
    ALTER TABLE shipments ADD estimated_delivery_at DATETIME2 NULL;
END;

IF COL_LENGTH('shipments', 'current_location') IS NULL
BEGIN
    ALTER TABLE shipments ADD current_location NVARCHAR(500) NULL;
END;

IF COL_LENGTH('shipments', 'current_lat') IS NULL
BEGIN
    ALTER TABLE shipments ADD current_lat DECIMAL(10, 7) NULL;
END;

IF COL_LENGTH('shipments', 'current_lng') IS NULL
BEGIN
    ALTER TABLE shipments ADD current_lng DECIMAL(10, 7) NULL;
END;

IF COL_LENGTH('shipments', 'confirmed_received_at') IS NULL
BEGIN
    ALTER TABLE shipments ADD confirmed_received_at DATETIME2 NULL;
END;

IF COL_LENGTH('shipments', 'confirmed_received_by_user_id') IS NULL
BEGIN
    ALTER TABLE shipments ADD confirmed_received_by_user_id BIGINT NULL;
    ALTER TABLE shipments ADD CONSTRAINT fk_shipments_confirmed_received_user FOREIGN KEY (confirmed_received_by_user_id) REFERENCES users(id);
END;

IF OBJECT_ID('shipment_incidents', 'U') IS NULL
BEGIN
    CREATE TABLE shipment_incidents (
        id BIGINT IDENTITY(1,1) PRIMARY KEY,
        shipment_id BIGINT NOT NULL,
        reported_by_user_id BIGINT NOT NULL,
        incident_type NVARCHAR(100) NOT NULL,
        description NVARCHAR(1000) NOT NULL,
        image_url NVARCHAR(1000) NULL,
        status NVARCHAR(50) NOT NULL,
        created_at DATETIME2 NOT NULL,
        resolved_at DATETIME2 NULL,
        resolution_note NVARCHAR(1000) NULL,
        CONSTRAINT fk_shipment_incidents_shipment FOREIGN KEY (shipment_id) REFERENCES shipments(id),
        CONSTRAINT fk_shipment_incidents_user FOREIGN KEY (reported_by_user_id) REFERENCES users(id)
    );
END;
