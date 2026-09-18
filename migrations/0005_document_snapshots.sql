CREATE TABLE document_snapshots (
    document_id TEXT PRIMARY KEY,
    company_id TEXT NOT NULL,

    snapshot_version INTEGER NOT NULL DEFAULT 1,

    company_snapshot_json TEXT NOT NULL,
    party_snapshot_json TEXT,
    payment_snapshot_json TEXT,

    signature_key TEXT,
    payment_qr_key TEXT,

    issued_by TEXT,
    issued_at TEXT NOT NULL,

    FOREIGN KEY (document_id)
        REFERENCES documents(id)
        ON DELETE CASCADE,

    FOREIGN KEY (company_id)
        REFERENCES companies(id),

    FOREIGN KEY (issued_by)
        REFERENCES users(id)
);

CREATE INDEX idx_document_snapshots_company_id
    ON document_snapshots(company_id);