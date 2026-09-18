-- ============================================================
-- SUBSCRIPTION PLANS
-- Defines the BillDesk product tiers.
-- Initially we will have one paid plan.
-- ============================================================

CREATE TABLE subscription_plans (
    id TEXT PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    description TEXT,

    is_active INTEGER NOT NULL DEFAULT 1
        CHECK (is_active IN (0, 1)),

    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);


-- ============================================================
-- SUBSCRIPTION PRICES
-- A plan can have multiple billing intervals.
-- We will initially enable MONTHLY and ANNUAL.
-- QUARTERLY and HALF_YEARLY are supported for future use.
-- ============================================================

CREATE TABLE subscription_prices (
    id TEXT PRIMARY KEY,
    plan_id TEXT NOT NULL,

    billing_interval TEXT NOT NULL
        CHECK (
            billing_interval IN (
                'MONTHLY',
                'QUARTERLY',
                'HALF_YEARLY',
                'ANNUAL'
            )
        ),

    amount_paise INTEGER NOT NULL
        CHECK (amount_paise > 0),

    currency_code TEXT NOT NULL DEFAULT 'INR',

    provider TEXT,
    provider_price_id TEXT,

    is_active INTEGER NOT NULL DEFAULT 1
        CHECK (is_active IN (0, 1)),

    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,

    FOREIGN KEY (plan_id)
        REFERENCES subscription_plans(id)
        ON DELETE CASCADE,

    UNIQUE (
        plan_id,
        billing_interval,
        currency_code
    )
);


-- ============================================================
-- COMPANY SUBSCRIPTIONS
-- One company can have subscription history over time.
-- The application will determine which subscription is current.
-- ============================================================

CREATE TABLE company_subscriptions (
    id TEXT PRIMARY KEY,
    company_id TEXT NOT NULL,
    plan_id TEXT NOT NULL,
    price_id TEXT NOT NULL,

    billing_interval TEXT NOT NULL
        CHECK (
            billing_interval IN (
                'MONTHLY',
                'QUARTERLY',
                'HALF_YEARLY',
                'ANNUAL'
            )
        ),

    status TEXT NOT NULL DEFAULT 'PENDING_PAYMENT'
        CHECK (
            status IN (
                'PENDING_PAYMENT',
                'ACTIVE',
                'PAST_DUE',
                'CANCELLED',
                'EXPIRED'
            )
        ),

    -- Snapshot the agreed price so historical subscriptions
    -- are unaffected if plan pricing changes later.
    amount_paise INTEGER NOT NULL
        CHECK (amount_paise > 0),

    currency_code TEXT NOT NULL DEFAULT 'INR',

    provider TEXT,
    provider_customer_id TEXT,
    provider_subscription_id TEXT,

    started_at TEXT,
    current_period_start TEXT,
    current_period_end TEXT,

    cancel_at_period_end INTEGER NOT NULL DEFAULT 0
        CHECK (cancel_at_period_end IN (0, 1)),

    cancelled_at TEXT,
    ended_at TEXT,

    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,

    FOREIGN KEY (company_id)
        REFERENCES companies(id)
        ON DELETE CASCADE,

    FOREIGN KEY (plan_id)
        REFERENCES subscription_plans(id)
        ON DELETE RESTRICT,

    FOREIGN KEY (price_id)
        REFERENCES subscription_prices(id)
        ON DELETE RESTRICT
);


-- ============================================================
-- PAYMENTS
-- Records payments made against BillDesk subscriptions.
-- Amounts are always stored in paise.
-- ============================================================

CREATE TABLE payments (
    id TEXT PRIMARY KEY,
    company_id TEXT NOT NULL,
    subscription_id TEXT,

    amount_paise INTEGER NOT NULL
        CHECK (amount_paise > 0),

    currency_code TEXT NOT NULL DEFAULT 'INR',

    status TEXT NOT NULL DEFAULT 'CREATED'
        CHECK (
            status IN (
                'CREATED',
                'PENDING',
                'PAID',
                'FAILED',
                'REFUNDED',
                'PARTIALLY_REFUNDED'
            )
        ),

    provider TEXT,
    provider_order_id TEXT,
    provider_payment_id TEXT,
    provider_invoice_id TEXT,

    paid_at TEXT,
    failed_at TEXT,
    refunded_at TEXT,

    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,

    FOREIGN KEY (company_id)
        REFERENCES companies(id)
        ON DELETE CASCADE,

    FOREIGN KEY (subscription_id)
        REFERENCES company_subscriptions(id)
        ON DELETE SET NULL
);


-- ============================================================
-- PAYMENT WEBHOOK EVENTS
-- Stores provider events for idempotency and auditability.
-- The same provider event must never be processed twice.
-- ============================================================

CREATE TABLE payment_webhook_events (
    id TEXT PRIMARY KEY,

    provider TEXT NOT NULL,
    provider_event_id TEXT NOT NULL,
    event_type TEXT NOT NULL,

    status TEXT NOT NULL DEFAULT 'RECEIVED'
        CHECK (
            status IN (
                'RECEIVED',
                'PROCESSED',
                'FAILED'
            )
        ),

    payload_json TEXT NOT NULL,

    attempt_count INTEGER NOT NULL DEFAULT 0
        CHECK (attempt_count >= 0),

    error_message TEXT,

    received_at TEXT NOT NULL,
    processed_at TEXT,

    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,

    UNIQUE (
        provider,
        provider_event_id
    )
);


-- ============================================================
-- INDEXES
-- ============================================================

CREATE INDEX idx_subscription_prices_plan
    ON subscription_prices (
        plan_id,
        is_active
    );

CREATE INDEX idx_company_subscriptions_company
    ON company_subscriptions (
        company_id,
        status
    );

CREATE INDEX idx_company_subscriptions_period_end
    ON company_subscriptions (
        current_period_end
    );

CREATE UNIQUE INDEX idx_company_subscriptions_provider_subscription
    ON company_subscriptions (
        provider,
        provider_subscription_id
    )
    WHERE provider_subscription_id IS NOT NULL;

CREATE INDEX idx_payments_company
    ON payments (
        company_id,
        created_at
    );

CREATE INDEX idx_payments_subscription
    ON payments (
        subscription_id
    );

CREATE INDEX idx_payments_status
    ON payments (
        status
    );

CREATE UNIQUE INDEX idx_payments_provider_payment
    ON payments (
        provider,
        provider_payment_id
    )
    WHERE provider_payment_id IS NOT NULL;

CREATE INDEX idx_payment_webhook_events_status
    ON payment_webhook_events (
        status,
        received_at
    );