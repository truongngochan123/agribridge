-- Migration: add verification scoring fields to companies table
-- Supports auto-approval flow: score, reason, tax lookup metadata, document URLs

ALTER TABLE companies ADD
    verification_score      INT             NULL,
    verification_reason     NVARCHAR(1000)  NULL,
    tax_lookup_status       NVARCHAR(50)    NULL,
    tax_lookup_provider     NVARCHAR(50)    NULL,
    identity_document_url   NVARCHAR(500)   NULL,
    business_license_url    NVARCHAR(500)   NULL;
