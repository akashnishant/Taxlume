-- ============================================================
-- AUDIT LOGS
-- Append-only record of important business actions.
-- ============================================================

CREATE TABLE audit_logs (
    id TEXT PRIMARY KEY,

    company_id TEXT NOT NULL,
    user_id TEXT,

    -- Entity being affected.
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,

    -- Action performed.
    action TEXT NOT NULL,

    -- Optional machine-readable details.
    metadata_json TEXT,

    created_at TEXT NOT NULL,

    FOREIGN KEY (company_id)
        REFERENCES companies(id)
        ON DELETE CASCADE,

    FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE SET NULL
);

CREATE INDEX idx_audit_logs_company_created
    ON audit_logs(company_id, created_at);

CREATE INDEX idx_audit_logs_entity
    ON audit_logs(entity_type, entity_id);

CREATE INDEX idx_audit_logs_user
    ON audit_logs(user_id);