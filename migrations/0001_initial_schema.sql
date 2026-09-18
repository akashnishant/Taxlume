PRAGMA foreign_keys = ON;

-- ============================================================
-- USERS
-- ============================================================

CREATE TABLE users (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    full_name TEXT NOT NULL,
    email_verified INTEGER NOT NULL DEFAULT 0 CHECK (email_verified IN (0, 1)),
    is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

-- ============================================================
-- COMPANIES
-- ============================================================

CREATE TABLE companies (
    id TEXT PRIMARY KEY,
    legal_name TEXT NOT NULL,
    trade_name TEXT,
    gstin TEXT,
    pan TEXT,
    email TEXT,
    phone TEXT,
    website TEXT,
    address_line1 TEXT,
    address_line2 TEXT,
    city TEXT,
    state TEXT,
    state_code TEXT,
    pincode TEXT,
    country TEXT NOT NULL DEFAULT 'India',
    logo_key TEXT,
    currency_code TEXT NOT NULL DEFAULT 'INR',
    financial_year_start_month INTEGER NOT NULL DEFAULT 4
        CHECK (financial_year_start_month BETWEEN 1 AND 12),
    is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

-- ============================================================
-- COMPANY MEMBERS
-- ============================================================

CREATE TABLE company_members (
    id TEXT PRIMARY KEY,
    company_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'OWNER',
    is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,

    FOREIGN KEY (company_id)
        REFERENCES companies(id)
        ON DELETE CASCADE,

    FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE CASCADE,

    UNIQUE(company_id, user_id)
);

-- ============================================================
-- PARTIES
-- A party can be a customer, vendor, or both.
-- ============================================================

CREATE TABLE parties (
    id TEXT PRIMARY KEY,
    company_id TEXT NOT NULL,
    display_name TEXT NOT NULL,
    legal_name TEXT,
    gstin TEXT,
    pan TEXT,
    email TEXT,
    phone TEXT,
    alternate_phone TEXT,
    contact_person TEXT,

    -- Monetary values are stored in paise.
    opening_balance_paise INTEGER NOT NULL DEFAULT 0,
    credit_limit_paise INTEGER NOT NULL DEFAULT 0,

    payment_terms_days INTEGER NOT NULL DEFAULT 0
        CHECK (payment_terms_days >= 0),

    notes TEXT,
    is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,

    FOREIGN KEY (company_id)
        REFERENCES companies(id)
        ON DELETE CASCADE
);

CREATE TABLE party_roles (
    id TEXT PRIMARY KEY,
    party_id TEXT NOT NULL,
    role TEXT NOT NULL,
    created_at TEXT NOT NULL,

    FOREIGN KEY (party_id)
        REFERENCES parties(id)
        ON DELETE CASCADE,

    UNIQUE(party_id, role)
);

CREATE TABLE party_addresses (
    id TEXT PRIMARY KEY,
    party_id TEXT NOT NULL,
    address_type TEXT NOT NULL,
    label TEXT,
    address_line1 TEXT NOT NULL,
    address_line2 TEXT,
    city TEXT,
    state TEXT,
    state_code TEXT,
    pincode TEXT,
    country TEXT NOT NULL DEFAULT 'India',
    is_default INTEGER NOT NULL DEFAULT 0 CHECK (is_default IN (0, 1)),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,

    FOREIGN KEY (party_id)
        REFERENCES parties(id)
        ON DELETE CASCADE
);

-- ============================================================
-- PRODUCTS / SERVICES
-- ============================================================

CREATE TABLE products (
    id TEXT PRIMARY KEY,
    company_id TEXT NOT NULL,

    -- PRODUCT or SERVICE
    item_type TEXT NOT NULL DEFAULT 'PRODUCT'
        CHECK (item_type IN ('PRODUCT', 'SERVICE')),

    name TEXT NOT NULL,
    description TEXT,
    sku TEXT,
    hsn_sac TEXT,

    unit TEXT NOT NULL DEFAULT 'NOS',

    -- Monetary values are stored in paise.
    selling_price_paise INTEGER NOT NULL DEFAULT 0,
    purchase_price_paise INTEGER NOT NULL DEFAULT 0,

    -- Tax rates are stored in basis points.
    -- Example: 18% = 1800.
    gst_rate_bps INTEGER NOT NULL DEFAULT 0
        CHECK (gst_rate_bps >= 0),

    cess_rate_bps INTEGER NOT NULL DEFAULT 0
        CHECK (cess_rate_bps >= 0),

    -- Quantity is stored in milli-units.
    -- Example: 1.5 = 1500.
    opening_stock_milli INTEGER NOT NULL DEFAULT 0,

    track_inventory INTEGER NOT NULL DEFAULT 1
        CHECK (track_inventory IN (0, 1)),

    is_active INTEGER NOT NULL DEFAULT 1
        CHECK (is_active IN (0, 1)),

    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,

    FOREIGN KEY (company_id)
        REFERENCES companies(id)
        ON DELETE CASCADE
);

-- ============================================================
-- DOCUMENTS
--
-- document_type examples:
-- TAX_INVOICE
-- PROFORMA_INVOICE
-- PURCHASE_ORDER
-- QUOTATION
-- DELIVERY_CHALLAN
-- ============================================================

CREATE TABLE documents (
    id TEXT PRIMARY KEY,
    company_id TEXT NOT NULL,

    document_type TEXT NOT NULL,
    document_number TEXT NOT NULL,
    document_date TEXT NOT NULL,
    due_date TEXT,

    party_id TEXT,

    -- DRAFT, ISSUED, CANCELLED
    status TEXT NOT NULL DEFAULT 'DRAFT'
        CHECK (status IN ('DRAFT', 'ISSUED', 'CANCELLED')),

    currency_code TEXT NOT NULL DEFAULT 'INR',

    place_of_supply_state TEXT,
    place_of_supply_state_code TEXT,
    supply_type TEXT,

    -- All monetary values are stored in paise.
    subtotal_paise INTEGER NOT NULL DEFAULT 0,
    discount_paise INTEGER NOT NULL DEFAULT 0,
    taxable_amount_paise INTEGER NOT NULL DEFAULT 0,

    cgst_paise INTEGER NOT NULL DEFAULT 0,
    sgst_paise INTEGER NOT NULL DEFAULT 0,
    igst_paise INTEGER NOT NULL DEFAULT 0,
    cess_paise INTEGER NOT NULL DEFAULT 0,

    round_off_paise INTEGER NOT NULL DEFAULT 0,
    total_paise INTEGER NOT NULL DEFAULT 0,
    amount_paid_paise INTEGER NOT NULL DEFAULT 0,

    notes TEXT,
    terms_and_conditions TEXT,
    reference_number TEXT,

    -- Used for document conversion chains.
    -- Example: Quotation -> Invoice.
    source_document_id TEXT,

    created_by TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,

    FOREIGN KEY (company_id)
        REFERENCES companies(id),

    FOREIGN KEY (party_id)
        REFERENCES parties(id),

    FOREIGN KEY (source_document_id)
        REFERENCES documents(id),

    FOREIGN KEY (created_by)
        REFERENCES users(id),

    UNIQUE(company_id, document_type, document_number)
);

-- ============================================================
-- DOCUMENT ITEMS
-- ============================================================

CREATE TABLE document_items (
    id TEXT PRIMARY KEY,
    document_id TEXT NOT NULL,
    product_id TEXT,

    line_number INTEGER NOT NULL
        CHECK (line_number > 0),

    -- Snapshot values are intentionally stored here.
    -- This prevents future product-master changes from
    -- changing historical invoices.
    item_name TEXT NOT NULL,
    description TEXT,
    hsn_sac TEXT,
    unit TEXT,

    -- Quantity stored in milli-units.
    quantity_milli INTEGER NOT NULL
        CHECK (quantity_milli >= 0),

    -- Rate and all amounts stored in paise.
    rate_paise INTEGER NOT NULL
        CHECK (rate_paise >= 0),

    discount_rate_bps INTEGER NOT NULL DEFAULT 0
        CHECK (discount_rate_bps >= 0),

    discount_paise INTEGER NOT NULL DEFAULT 0,

    taxable_amount_paise INTEGER NOT NULL DEFAULT 0,

    gst_rate_bps INTEGER NOT NULL DEFAULT 0,
    cgst_rate_bps INTEGER NOT NULL DEFAULT 0,
    sgst_rate_bps INTEGER NOT NULL DEFAULT 0,
    igst_rate_bps INTEGER NOT NULL DEFAULT 0,

    cgst_paise INTEGER NOT NULL DEFAULT 0,
    sgst_paise INTEGER NOT NULL DEFAULT 0,
    igst_paise INTEGER NOT NULL DEFAULT 0,

    cess_rate_bps INTEGER NOT NULL DEFAULT 0,
    cess_paise INTEGER NOT NULL DEFAULT 0,

    total_paise INTEGER NOT NULL DEFAULT 0,

    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,

    FOREIGN KEY (document_id)
        REFERENCES documents(id)
        ON DELETE CASCADE,

    FOREIGN KEY (product_id)
        REFERENCES products(id),

    UNIQUE(document_id, line_number)
);

-- ============================================================
-- DOCUMENT NUMBER SEQUENCES
-- Prevents unsafe MAX(number) + 1 numbering.
-- ============================================================

CREATE TABLE document_number_sequences (
    id TEXT PRIMARY KEY,
    company_id TEXT NOT NULL,
    document_type TEXT NOT NULL,
    financial_year TEXT NOT NULL,

    prefix TEXT,
    suffix TEXT,

    next_number INTEGER NOT NULL DEFAULT 1
        CHECK (next_number >= 1),

    padding INTEGER NOT NULL DEFAULT 4
        CHECK (padding BETWEEN 1 AND 12),

    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,

    FOREIGN KEY (company_id)
        REFERENCES companies(id)
        ON DELETE CASCADE,

    UNIQUE(company_id, document_type, financial_year)
);

-- ============================================================
-- INDEXES
-- ============================================================

CREATE INDEX idx_company_members_user
    ON company_members(user_id);

CREATE INDEX idx_parties_company
    ON parties(company_id);

CREATE INDEX idx_party_roles_party
    ON party_roles(party_id);

CREATE INDEX idx_party_addresses_party
    ON party_addresses(party_id);

CREATE INDEX idx_products_company
    ON products(company_id);

CREATE INDEX idx_documents_company
    ON documents(company_id);

CREATE INDEX idx_documents_company_date
    ON documents(company_id, document_date);

CREATE INDEX idx_documents_company_type_date
    ON documents(company_id, document_type, document_date);

CREATE INDEX idx_documents_party
    ON documents(party_id);

CREATE INDEX idx_document_items_document
    ON document_items(document_id);

CREATE INDEX idx_document_items_product
    ON document_items(product_id);

CREATE INDEX idx_document_sequences_company
    ON document_number_sequences(company_id);