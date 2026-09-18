ALTER TABLE company_subscriptions
ADD COLUMN provider_status TEXT;

ALTER TABLE company_subscriptions
ADD COLUMN provider_event_created_at INTEGER;

ALTER TABLE company_subscriptions
ADD COLUMN provider_event_id TEXT;