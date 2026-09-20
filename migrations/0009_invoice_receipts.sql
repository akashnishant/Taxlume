PRAGMA foreign_keys = ON;

CREATE TABLE invoice_receipts (
    id TEXT PRIMARY KEY,
    company_id TEXT NOT NULL,
    document_id TEXT NOT NULL,

    amount_paise INTEGER NOT NULL
        CHECK (amount_paise > 0),

    payment_date TEXT NOT NULL,

    payment_method TEXT NOT NULL
        CHECK (
            payment_method IN (
                'CASH',
                'UPI',
                'BANK_TRANSFER',
                'CHEQUE',
                'CARD',
                'OTHER'
            )
        ),

    reference_number TEXT,
    notes TEXT,

    status TEXT NOT NULL DEFAULT 'RECORDED'
        CHECK (status IN ('RECORDED', 'REVERSED')),

    created_by TEXT NOT NULL,
    created_at TEXT NOT NULL,

    reversed_by TEXT,
    reversed_at TEXT,
    reversal_reason TEXT,

    FOREIGN KEY (company_id)
        REFERENCES companies(id),

    FOREIGN KEY (document_id)
        REFERENCES documents(id),

    FOREIGN KEY (created_by)
        REFERENCES users(id),

    FOREIGN KEY (reversed_by)
        REFERENCES users(id),

    CHECK (
        (
            status = 'RECORDED'
            AND reversed_by IS NULL
            AND reversed_at IS NULL
            AND reversal_reason IS NULL
        )
        OR
        (
            status = 'REVERSED'
            AND reversed_by IS NOT NULL
            AND reversed_at IS NOT NULL
            AND reversal_reason IS NOT NULL
            AND length(trim(reversal_reason)) > 0
        )
    )
);

CREATE INDEX idx_invoice_receipts_document
    ON invoice_receipts (
        company_id,
        document_id,
        created_at
    );

CREATE INDEX idx_invoice_receipts_company_date
    ON invoice_receipts (
        company_id,
        payment_date
    );