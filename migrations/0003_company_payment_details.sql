PRAGMA foreign_keys = ON;

CREATE TABLE company_payment_details (
    id TEXT PRIMARY KEY,
    company_id TEXT NOT NULL UNIQUE,

    bank_name TEXT,
    account_holder_name TEXT,
    account_number TEXT,
    ifsc_code TEXT,
    branch_name TEXT,

    upi_id TEXT,
    qr_code_key TEXT,
    show_qr_on_invoice INTEGER NOT NULL DEFAULT 1
        CHECK (show_qr_on_invoice IN (0, 1)),

    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,

    FOREIGN KEY (company_id)
        REFERENCES companies(id)
        ON DELETE CASCADE
);

CREATE INDEX idx_company_payment_details_company
    ON company_payment_details(company_id);