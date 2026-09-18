import { createRazorpayPlan } from "../payments/razorpayPlans";
import type {
    ActiveSubscriptionPrice,
} from "./subscriptionPriceRepository";

type ProviderPriceRow = {
    provider: string | null;
    provider_price_id: string | null;
};

function getBillingLabel(
    billingInterval:
        ActiveSubscriptionPrice["billing_interval"],
): string {
    switch (billingInterval) {
        case "MONTHLY":
            return "Monthly";

        case "QUARTERLY":
            return "Quarterly";

        case "HALF_YEARLY":
            return "Half-Yearly";

        case "ANNUAL":
            return "Annual";
    }
}

export async function ensureRazorpayPlan(
    env: Env,
    price: ActiveSubscriptionPrice,
): Promise<string> {
    if (
        price.provider &&
        price.provider !== "RAZORPAY"
    ) {
        throw new Error(
            `Subscription price ${price.id} is configured for a different payment provider.`,
        );
    }

    if (price.provider_price_id) {
        return price.provider_price_id;
    }

    const billingLabel =
        getBillingLabel(
            price.billing_interval,
        );

    const razorpayPlan =
        await createRazorpayPlan(
            env,
            {
                name:
                    `${price.plan_name} - ${billingLabel}`,

                description:
                    price.plan_description,

                amountPaise:
                    price.amount_paise,

                currencyCode:
                    price.currency_code,

                billingInterval:
                    price.billing_interval,
            },
        );

    const now =
        new Date().toISOString();

    const updateResult =
        await env.DB
            .prepare(`
                UPDATE subscription_prices
                SET
                    provider = 'RAZORPAY',
                    provider_price_id = ?,
                    updated_at = ?
                WHERE id = ?
                    AND provider_price_id IS NULL
            `)
            .bind(
                razorpayPlan.id,
                now,
                price.id,
            )
            .run();

    if (
        (updateResult.meta.changes ?? 0) > 0
    ) {
        return razorpayPlan.id;
    }

    /*
     * Another checkout may have provisioned this
     * price concurrently. Re-read D1 and use the
     * provider plan that actually won the update.
     */
    const stored =
        await env.DB
            .prepare(`
                SELECT
                    provider,
                    provider_price_id
                FROM subscription_prices
                WHERE id = ?
                LIMIT 1
            `)
            .bind(price.id)
            .first<ProviderPriceRow>();

    if (
        stored?.provider === "RAZORPAY" &&
        stored.provider_price_id
    ) {
        return stored.provider_price_id;
    }

    throw new Error(
        `Unable to persist the Razorpay plan for subscription price ${price.id}.`,
    );
}