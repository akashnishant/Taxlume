import { OpenAPIRoute } from "chanfana";
import { z } from "zod";
import { type AppContext } from "../types";

const SubscriptionStatus = z.enum([
    "PENDING_PAYMENT",
    "ACTIVE",
    "PAST_DUE",
    "CANCELLED",
    "EXPIRED",
]);

const BillingInterval = z.enum([
    "MONTHLY",
    "QUARTERLY",
    "HALF_YEARLY",
    "ANNUAL",
]);

type SubscriptionRow = {
    id: string;

    plan_id: string;
    plan_code: string;
    plan_name: string;

    price_id: string;

    billing_interval:
        | "MONTHLY"
        | "QUARTERLY"
        | "HALF_YEARLY"
        | "ANNUAL";

    status:
        | "PENDING_PAYMENT"
        | "ACTIVE"
        | "PAST_DUE"
        | "CANCELLED"
        | "EXPIRED";

    amount_paise: number;
    currency_code: string;

    current_period_start: string | null;
    current_period_end: string | null;

    cancel_at_period_end: number;

    created_at: string;
    updated_at: string;
};

export class SubscriptionCurrent extends OpenAPIRoute {
    schema = {
        tags: ["Subscriptions"],
        summary:
            "Get the authenticated company's current subscription",

        responses: {
            "200": {
                description:
                    "Current subscription details",
                content: {
                    "application/json": {
                        schema: z.object({
                            success: z.boolean(),

                            has_active_subscription:
                                z.boolean(),

                            subscription: z
                                .object({
                                    id: z.string(),

                                    plan: z.object({
                                        id: z.string(),
                                        code: z.string(),
                                        name: z.string(),
                                    }),

                                    price_id: z.string(),

                                    billing_interval:
                                        BillingInterval,

                                    status:
                                        SubscriptionStatus,

                                    amount_paise:
                                        z.number().int(),

                                    currency_code:
                                        z.string(),

                                    current_period_start:
                                        z.string().nullable(),

                                    current_period_end:
                                        z.string().nullable(),

                                    cancel_at_period_end:
                                        z.boolean(),

                                    created_at:
                                        z.string(),

                                    updated_at:
                                        z.string(),
                                })
                                .nullable(),
                        }),
                    },
                },
            },

            "401": {
                description:
                    "Authentication required",
            },
        },
    };

    async handle(c: AppContext) {
        const companyId =
            c.get("companyId");

        if (!companyId) {
            return c.json(
                {
                    success: false,
                    message:
                        "Authentication context is missing",
                },
                401,
            );
        }

        const subscription = await c.env.DB
            .prepare(`
                SELECT
                    cs.id,

                    cs.plan_id,
                    sp.code AS plan_code,
                    sp.name AS plan_name,

                    cs.price_id,
                    cs.billing_interval,
                    cs.status,

                    cs.amount_paise,
                    cs.currency_code,

                    cs.current_period_start,
                    cs.current_period_end,

                    cs.cancel_at_period_end,

                    cs.created_at,
                    cs.updated_at

                FROM company_subscriptions cs

                INNER JOIN subscription_plans sp
                    ON sp.id = cs.plan_id

                WHERE cs.company_id = ?

                ORDER BY
                    CASE cs.status
                        WHEN 'ACTIVE' THEN 1
                        WHEN 'PENDING_PAYMENT' THEN 2
                        WHEN 'PAST_DUE' THEN 3
                        WHEN 'CANCELLED' THEN 4
                        WHEN 'EXPIRED' THEN 5
                        ELSE 6
                    END ASC,
                    cs.updated_at DESC

                LIMIT 1
            `)
            .bind(companyId)
            .first<SubscriptionRow>();

        if (!subscription) {
            return c.json({
                success: true,
                has_active_subscription: false,
                subscription: null,
            });
        }

        const now =
            new Date().toISOString();

        const hasActiveSubscription =
            subscription.status === "ACTIVE" &&
            subscription.current_period_start !== null &&
            subscription.current_period_end !== null &&
            subscription.current_period_start <= now &&
            subscription.current_period_end > now;

        return c.json({
            success: true,

            has_active_subscription:
                hasActiveSubscription,

            subscription: {
                id: subscription.id,

                plan: {
                    id: subscription.plan_id,
                    code: subscription.plan_code,
                    name: subscription.plan_name,
                },

                price_id:
                    subscription.price_id,

                billing_interval:
                    subscription.billing_interval,

                status:
                    subscription.status,

                amount_paise:
                    subscription.amount_paise,

                currency_code:
                    subscription.currency_code,

                current_period_start:
                    subscription.current_period_start,

                current_period_end:
                    subscription.current_period_end,

                cancel_at_period_end:
                    subscription.cancel_at_period_end === 1,

                created_at:
                    subscription.created_at,

                updated_at:
                    subscription.updated_at,
            },
        });
    }
}