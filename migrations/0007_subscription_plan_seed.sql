-- ============================================================
-- TAXLUME INITIAL SUBSCRIPTION PLAN
-- ============================================================

INSERT INTO subscription_plans (
    id,
    code,
    name,
    description,
    is_active,
    created_at,
    updated_at
)
VALUES (
    'plan_taxlume_standard',
    'STANDARD',
    'Taxlume Standard',
    'Smart billing for growing businesses',
    1,
    strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
    strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
);


-- ============================================================
-- MONTHLY PRICE
-- ₹499 / month
-- ============================================================

INSERT INTO subscription_prices (
    id,
    plan_id,
    billing_interval,
    amount_paise,
    currency_code,
    provider,
    provider_price_id,
    is_active,
    created_at,
    updated_at
)
VALUES (
    'price_taxlume_standard_monthly_inr',
    'plan_taxlume_standard',
    'MONTHLY',
    49900,
    'INR',
    NULL,
    NULL,
    1,
    strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
    strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
);


-- ============================================================
-- ANNUAL PRICE
-- ₹4,990 / year
-- Approximately two months free compared with monthly billing.
-- ============================================================

INSERT INTO subscription_prices (
    id,
    plan_id,
    billing_interval,
    amount_paise,
    currency_code,
    provider,
    provider_price_id,
    is_active,
    created_at,
    updated_at
)
VALUES (
    'price_taxlume_standard_annual_inr',
    'plan_taxlume_standard',
    'ANNUAL',
    499000,
    'INR',
    NULL,
    NULL,
    1,
    strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
    strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
);