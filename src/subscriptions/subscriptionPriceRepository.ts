import type { BillingInterval } from "./subscriptionCycles";

export type ActiveSubscriptionPrice = {
    id: string;
    plan_id: string;
    plan_code: string;
    plan_name: string;
    plan_description: string | null;

    billing_interval: BillingInterval;
    amount_paise: number;
    currency_code: string;

    provider: string | null;
    provider_price_id: string | null;
};

export async function getActiveSubscriptionPrice(
    db: D1Database,
    priceId: string,
): Promise<ActiveSubscriptionPrice | null> {
    return db
        .prepare(`
            SELECT
                sp.id,
                sp.plan_id,
                p.code AS plan_code,
                p.name AS plan_name,
                p.description AS plan_description,
                sp.billing_interval,
                sp.amount_paise,
                sp.currency_code,
                sp.provider,
                sp.provider_price_id
            FROM subscription_prices sp
            INNER JOIN subscription_plans p
                ON p.id = sp.plan_id
            WHERE sp.id = ?
                AND sp.is_active = 1
                AND p.is_active = 1
            LIMIT 1
        `)
        .bind(priceId)
        .first<ActiveSubscriptionPrice>();
}