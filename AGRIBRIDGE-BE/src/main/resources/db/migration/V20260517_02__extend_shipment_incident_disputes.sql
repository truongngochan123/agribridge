IF COL_LENGTH('shipment_incidents', 'supplier_response') IS NULL
BEGIN
    ALTER TABLE shipment_incidents ADD supplier_response NVARCHAR(MAX) NULL;
END;

IF COL_LENGTH('shipment_incidents', 'supplier_evidence_urls') IS NULL
BEGIN
    ALTER TABLE shipment_incidents ADD supplier_evidence_urls NVARCHAR(MAX) NULL;
END;

IF COL_LENGTH('shipment_incidents', 'proposed_resolution') IS NULL
BEGIN
    ALTER TABLE shipment_incidents ADD proposed_resolution NVARCHAR(MAX) NULL;
END;

IF COL_LENGTH('shipment_incidents', 'resolution_type') IS NULL
BEGIN
    ALTER TABLE shipment_incidents ADD resolution_type NVARCHAR(80) NULL;
END;

IF COL_LENGTH('shipment_incidents', 'buyer_action_required_at') IS NULL
BEGIN
    ALTER TABLE shipment_incidents ADD buyer_action_required_at DATETIME2 NULL;
END;
