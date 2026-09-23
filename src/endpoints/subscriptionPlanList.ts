import { OpenAPIRoute } from "chanfana";
import { z } from "zod";
import { type AppContext } from "../types";

const BillingInterval = z.enum([
    "MONTHLY",
    "QUARTERLY",
    "HALF_YEARLY",
    "ANNUAL",
]);

type BillingIntervalValue =
    z.infer<typeof BillingInterval>;

type SubscriptionPlanRow = {
    plan_id: string;
    code: string;
    name: string;
    description: string | null;

    price_id: string;
    billing_interval: BillingIntervalValue;
    amount_paise: number;
    currency_code: string;
};

type SubscriptionPrice = {
    id: string;
    billing_interval: BillingIntervalValue;
    amount_paise: number;
    currency_code: string;
};

type SubscriptionPlan = {
    id: string;
    code: string;
    name: string;
    description: string | null;
    prices: SubscriptionPrice[];
};

export class SubscriptionPlanList extends OpenAPIRoute {
    schema = {
        tags: ["Subscriptions"],
        summary: "List active Techabanca Billing subscription plans",

        responses: {
            "200": {
                description:
                    "Active subscription plans and prices",
                content: {
                    "application/json": {
                        schema: z.object({
                            success: z.boolean(),

                            plans: z.array(
                                z.object({
                                    id: z.string(),
                                    code: z.string(),
                                    name: z.string(),
                                    description:
                                        z.string().nullable(),

                                    prices: z.array(
                                        z.object({
                                            id: z.string(),

                                            billing_interval:
                                                BillingInterval,

                                            amount_paise:
                                                z.number().int(),

                                            currency_code:
                                                z.string(),
                                        }),
                                    ),
                                }),
                            ),
                        }),
                    },
                },
            },
        },
    };

    async handle(c: AppContext) {
        const result = await c.env.DB
            .prepare(`
                SELECT
                    sp.id AS plan_id,
                    sp.code,
                    sp.name,
                    sp.description,

                    spr.id AS price_id,
                    spr.billing_interval,
                    spr.amount_paise,
                    spr.currency_code

                FROM subscription_plans sp

                INNER JOIN subscription_prices spr
                    ON spr.plan_id = sp.id

                WHERE sp.is_active = 1
                    AND spr.is_active = 1

                ORDER BY
                    sp.name ASC,
                    CASE spr.billing_interval
                        WHEN 'MONTHLY' THEN 1
                        WHEN 'QUARTERLY' THEN 2
                        WHEN 'HALF_YEARLY' THEN 3
                        WHEN 'ANNUAL' THEN 4
                        ELSE 5
                    END ASC
            `)
            .all<SubscriptionPlanRow>();

        const planMap =
            new Map<string, SubscriptionPlan>();

        for (const row of result.results) {
            let plan = planMap.get(row.plan_id);

            if (!plan) {
                plan = {
                    id: row.plan_id,
                    code: row.code,
                    name: row.name,
                    description: row.description,
                    prices: [],
                };

                planMap.set(row.plan_id, plan);
            }

            plan.prices.push({
                id: row.price_id,
                billing_interval:
                    row.billing_interval,
                amount_paise: row.amount_paise,
                currency_code: row.currency_code,
            });
        }

        return c.json({
            success: true,
            plans: [...planMap.values()],
        });
    }
}