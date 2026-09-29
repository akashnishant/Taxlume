-- Store an optional E-Way Bill number on billing documents.
-- Existing rows remain NULL; no existing document data is rewritten.

ALTER TABLE documents
ADD COLUMN e_way_bill_number TEXT;
