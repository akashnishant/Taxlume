-- Techabanca Billing
-- Expenses V1
-- Migration: 0015_expenses.sql

-- ============================================================
-- EXPENSE CATEGORIES
-- ============================================================

CREATE TABLE expense_categories (
    id TEXT PRIMARY KEY NOT NULL,

    company_id TEXT NOT NULL,

    name TEXT NOT NULL,
    parent_category_id TEXT,
    description TEXT,

    display_order INTEGER NOT NULL DEFAULT 0
        CHECK (display_order >= 0),

    is_active INTEGER NOT NULL DEFAULT 1
        CHECK (is_active IN (0, 1)),

    created_by TEXT NOT NULL,
    updated_by TEXT,

    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,

    FOREIGN KEY (company_id)
        REFERENCES companies(id),

    FOREIGN KEY (parent_category_id)
        REFERENCES expense_categories(id),

    FOREIGN KEY (created_by)
        REFERENCES users(id),

    FOREIGN KEY (updated_by)
        REFERENCES users(id),

    CHECK (length(trim(name)) > 0)
);

CREATE INDEX idx_expense_categories_company
    ON expense_categories(company_id);

CREATE INDEX idx_expense_categories_parent
    ON expense_categories(company_id, parent_category_id);

CREATE INDEX idx_expense_categories_active
    ON expense_categories(company_id, is_active, display_order, name);

-- SQLite treats NULLs as distinct in UNIQUE constraints, therefore
-- top-level and child category uniqueness are enforced separately.

CREATE UNIQUE INDEX ux_expense_categories_top_level_name
    ON expense_categories(company_id, lower(name))
    WHERE parent_category_id IS NULL;

CREATE UNIQUE INDEX ux_expense_categories_child_name
    ON expense_categories(
        company_id,
        parent_category_id,
        lower(name)
    )
    WHERE parent_category_id IS NOT NULL;


-- ============================================================
-- RECURRING EXPENSE RULES
-- ============================================================

CREATE TABLE recurring_expense_rules (
    id TEXT PRIMARY KEY NOT NULL,

    company_id TEXT NOT NULL,

    name TEXT NOT NULL,

    category_id TEXT NOT NULL,

    vendor_id TEXT,
    payee_name TEXT,

    description TEXT,
    notes TEXT,

    amount_paise INTEGER NOT NULL
        CHECK (amount_paise > 0),

    currency_code TEXT NOT NULL,

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

    frequency TEXT NOT NULL
        CHECK (
            frequency IN (
                'DAILY',
                'WEEKLY',
                'MONTHLY',
                'YEARLY'
            )
        ),

    interval_count INTEGER NOT NULL DEFAULT 1
        CHECK (interval_count > 0),

    start_date TEXT NOT NULL,
    end_date TEXT,

    next_run_date TEXT NOT NULL,
    last_run_date TEXT,

    is_active INTEGER NOT NULL DEFAULT 1
        CHECK (is_active IN (0, 1)),

    created_by TEXT NOT NULL,
    updated_by TEXT,
    deleted_by TEXT,

    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    deleted_at TEXT,

    FOREIGN KEY (company_id)
        REFERENCES companies(id),

    FOREIGN KEY (category_id)
        REFERENCES expense_categories(id),

    FOREIGN KEY (vendor_id)
        REFERENCES parties(id),

    FOREIGN KEY (created_by)
        REFERENCES users(id),

    FOREIGN KEY (updated_by)
        REFERENCES users(id),

    FOREIGN KEY (deleted_by)
        REFERENCES users(id),

    CHECK (length(trim(name)) > 0),

    CHECK (
        length(currency_code) = 3
        AND currency_code = upper(currency_code)
    ),

    CHECK (
        end_date IS NULL
        OR end_date >= start_date
    )
);

CREATE INDEX idx_recurring_expense_rules_company
    ON recurring_expense_rules(company_id);

CREATE INDEX idx_recurring_expense_rules_due
    ON recurring_expense_rules(
        company_id,
        is_active,
        next_run_date
    )
    WHERE deleted_at IS NULL;

CREATE INDEX idx_recurring_expense_rules_category
    ON recurring_expense_rules(
        company_id,
        category_id
    )
    WHERE deleted_at IS NULL;

CREATE INDEX idx_recurring_expense_rules_vendor
    ON recurring_expense_rules(
        company_id,
        vendor_id
    )
    WHERE deleted_at IS NULL;


-- ============================================================
-- EXPENSES
-- ============================================================

CREATE TABLE expenses (
    id TEXT PRIMARY KEY NOT NULL,

    company_id TEXT NOT NULL,

    expense_date TEXT NOT NULL,

    category_id TEXT NOT NULL,

    vendor_id TEXT,
    payee_name TEXT,

    description TEXT,
    notes TEXT,

    amount_paise INTEGER NOT NULL
        CHECK (amount_paise > 0),

    currency_code TEXT NOT NULL,

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

    source TEXT NOT NULL DEFAULT 'MANUAL'
        CHECK (
            source IN (
                'MANUAL',
                'RECURRING'
            )
        ),

    recurring_rule_id TEXT,
    recurring_occurrence_date TEXT,

    client_request_id TEXT,

    created_by TEXT NOT NULL,
    updated_by TEXT,
    deleted_by TEXT,

    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    deleted_at TEXT,

    FOREIGN KEY (company_id)
        REFERENCES companies(id),

    FOREIGN KEY (category_id)
        REFERENCES expense_categories(id),

    FOREIGN KEY (vendor_id)
        REFERENCES parties(id),

    FOREIGN KEY (recurring_rule_id)
        REFERENCES recurring_expense_rules(id),

    FOREIGN KEY (created_by)
        REFERENCES users(id),

    FOREIGN KEY (updated_by)
        REFERENCES users(id),

    FOREIGN KEY (deleted_by)
        REFERENCES users(id),

    CHECK (
        length(currency_code) = 3
        AND currency_code = upper(currency_code)
    ),

    CHECK (
        (
            source = 'MANUAL'
            AND recurring_rule_id IS NULL
            AND recurring_occurrence_date IS NULL
        )
        OR
        (
            source = 'RECURRING'
            AND recurring_rule_id IS NOT NULL
            AND recurring_occurrence_date IS NOT NULL
        )
    )
);

-- Main list/report query.
CREATE INDEX idx_expenses_company_date
    ON expenses(
        company_id,
        expense_date DESC,
        created_at DESC
    )
    WHERE deleted_at IS NULL;

CREATE INDEX idx_expenses_company_category_date
    ON expenses(
        company_id,
        category_id,
        expense_date DESC
    )
    WHERE deleted_at IS NULL;

CREATE INDEX idx_expenses_company_vendor_date
    ON expenses(
        company_id,
        vendor_id,
        expense_date DESC
    )
    WHERE deleted_at IS NULL;

CREATE INDEX idx_expenses_company_payment_date
    ON expenses(
        company_id,
        payment_method,
        expense_date DESC
    )
    WHERE deleted_at IS NULL;

CREATE INDEX idx_expenses_company_source_date
    ON expenses(
        company_id,
        source,
        expense_date DESC
    )
    WHERE deleted_at IS NULL;

CREATE INDEX idx_expenses_recurring_rule
    ON expenses(
        company_id,
        recurring_rule_id,
        expense_date DESC
    )
    WHERE recurring_rule_id IS NOT NULL
      AND deleted_at IS NULL;

-- Prevent a browser retry / double click from creating
-- the same manually-submitted expense more than once.
CREATE UNIQUE INDEX ux_expenses_client_request
    ON expenses(
        company_id,
        client_request_id
    )
    WHERE client_request_id IS NOT NULL;

-- Prevent a recurring rule retry from generating the same
-- occurrence twice.
CREATE UNIQUE INDEX ux_expenses_recurring_occurrence
    ON expenses(
        company_id,
        recurring_rule_id,
        recurring_occurrence_date
    )
    WHERE recurring_rule_id IS NOT NULL
      AND recurring_occurrence_date IS NOT NULL;


-- ============================================================
-- EXPENSE ATTACHMENTS
-- ============================================================

CREATE TABLE expense_attachments (
    id TEXT PRIMARY KEY NOT NULL,

    company_id TEXT NOT NULL,
    expense_id TEXT NOT NULL,

    object_key TEXT NOT NULL,

    original_filename TEXT NOT NULL,
    content_type TEXT NOT NULL,

    size_bytes INTEGER NOT NULL
        CHECK (size_bytes > 0),

    created_by TEXT NOT NULL,
    deleted_by TEXT,

    created_at TEXT NOT NULL,
    deleted_at TEXT,

    FOREIGN KEY (company_id)
        REFERENCES companies(id),

    FOREIGN KEY (expense_id)
        REFERENCES expenses(id),

    FOREIGN KEY (created_by)
        REFERENCES users(id),

    FOREIGN KEY (deleted_by)
        REFERENCES users(id)
);

CREATE UNIQUE INDEX ux_expense_attachments_object_key
    ON expense_attachments(object_key);

CREATE INDEX idx_expense_attachments_expense
    ON expense_attachments(
        company_id,
        expense_id,
        created_at
    )
    WHERE deleted_at IS NULL;
