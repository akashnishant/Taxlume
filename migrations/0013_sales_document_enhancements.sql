-- ============================================================
-- SALES DOCUMENT ENHANCEMENTS
-- Ship To, Payment Terms, Customer PO and Additional Charge
-- ============================================================

ALTER TABLE documents
ADD COLUMN payment_terms_code TEXT;

ALTER TABLE documents
ADD COLUMN payment_terms_custom TEXT;

ALTER TABLE documents
ADD COLUMN customer_po_number TEXT;

-- NULL = legacy document created before Ship To support.
-- 1 = same as Bill To.
-- 0 = explicit shipping address stored below.
ALTER TABLE documents
ADD COLUMN ship_to_same_as_bill_to INTEGER
    CHECK (
        ship_to_same_as_bill_to IS NULL
        OR ship_to_same_as_bill_to IN (0, 1)
    );

ALTER TABLE documents
ADD COLUMN ship_to_name TEXT;

ALTER TABLE documents
ADD COLUMN ship_to_contact_person TEXT;

ALTER TABLE documents
ADD COLUMN ship_to_gstin TEXT;

ALTER TABLE documents
ADD COLUMN ship_to_phone TEXT;

ALTER TABLE documents
ADD COLUMN ship_to_email TEXT;

ALTER TABLE documents
ADD COLUMN ship_to_address_line1 TEXT;

ALTER TABLE documents
ADD COLUMN ship_to_address_line2 TEXT;

ALTER TABLE documents
ADD COLUMN ship_to_city TEXT;

ALTER TABLE documents
ADD COLUMN ship_to_state TEXT;

ALTER TABLE documents
ADD COLUMN ship_to_state_code TEXT;

ALTER TABLE documents
ADD COLUMN ship_to_pincode TEXT;

ALTER TABLE documents
ADD COLUMN ship_to_country TEXT;

ALTER TABLE documents
ADD COLUMN additional_charge_label TEXT;

ALTER TABLE documents
ADD COLUMN additional_charge_paise INTEGER NOT NULL DEFAULT 0
    CHECK (additional_charge_paise >= 0);

ALTER TABLE documents
ADD COLUMN additional_charge_taxable INTEGER NOT NULL DEFAULT 0
    CHECK (additional_charge_taxable IN (0, 1));

ALTER TABLE documents
ADD COLUMN additional_charge_gst_rate_bps INTEGER NOT NULL DEFAULT 0
    CHECK (
        additional_charge_gst_rate_bps >= 0
        AND additional_charge_gst_rate_bps <= 10000
    );

-- Store the calculated charge-tax components separately as well.
-- Aggregate document CGST/SGST/IGST fields will include these values.
ALTER TABLE documents
ADD COLUMN additional_charge_cgst_paise INTEGER NOT NULL DEFAULT 0
    CHECK (additional_charge_cgst_paise >= 0);

ALTER TABLE documents
ADD COLUMN additional_charge_sgst_paise INTEGER NOT NULL DEFAULT 0
    CHECK (additional_charge_sgst_paise >= 0);

ALTER TABLE documents
ADD COLUMN additional_charge_igst_paise INTEGER NOT NULL DEFAULT 0
    CHECK (additional_charge_igst_paise >= 0);
