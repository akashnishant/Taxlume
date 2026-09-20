-- Existing receipts retain NULL. New payment submissions will
-- supply a client-generated UUID through the API.
ALTER TABLE invoice_receipts
ADD COLUMN client_request_id TEXT;

-- A submission ID can identify only one receipt within a company.
-- Multiple existing NULL values are permitted.
CREATE UNIQUE INDEX idx_invoice_receipts_client_request
ON invoice_receipts (company_id, client_request_id)
WHERE client_request_id IS NOT NULL;

-- Once assigned, a receipt's submission ID cannot be changed.
-- This also protects it during receipt reversal.
CREATE TRIGGER invoice_receipts_preserve_request_id
BEFORE UPDATE OF client_request_id ON invoice_receipts
FOR EACH ROW
WHEN NEW.client_request_id IS NOT OLD.client_request_id
BEGIN
    SELECT RAISE(
        ABORT,
        'Receipt submission ID cannot be changed.'
    );
END;