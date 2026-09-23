-- Rebrand the displayed plan without changing IDs referenced by subscriptions,
-- prices, or Razorpay. Preserve a custom name if it has already been edited.
UPDATE subscription_plans
SET name = 'Techabanca Billing Standard',
    updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE id = 'plan_taxlume_standard'
    AND name = 'Taxlume Standard';
