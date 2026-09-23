import { OpenAPIRoute } from "chanfana";
import { z } from "zod";
import { type AppContext } from "../types";
import {
    getActiveSubscriptionPrice,
} from "../subscriptions/subscriptionPriceRepository";
import {
    ensureRazorpayPlan,
} from "../subscriptions/ensureRazorpayPlan";
import {
    getSubscriptionTotalCount,
} from "../subscriptions/subscriptionCycles";
import {
    createRazorpaySubscription,
} from "../payments/razorpaySubscriptions";
import {
    RazorpayRequestError,
} from "../payments/razorpayClient";

const SubscriptionCheckoutRequest = z.object({
    price_id: z
        .string()
        .trim()
        .min(1)
        .max(200),
});

type ExistingActiveSubscription = {
    id: string;
};

type ExistingPendingSubscription = {
    id: string;
    provider_subscription_id: string;
};

const CheckoutResponseSchema = z.object({
    success: z.boolean(),

    checkout: z.object({
        subscription_id: z.string(),

        provider: z.literal("RAZORPAY"),
        provider_subscription_id: z.string(),
        provider_key_id: z.string(),

        price_id: z.string(),
        billing_interval: z.enum([
            "MONTHLY",
            "QUARTERLY",
            "HALF_YEARLY",
            "ANNUAL",
        ]),

        amount_paise: z.number().int(),
        currency_code: z.string(),

        plan_name: z.string(),
    }),
});

export class SubscriptionCheckout extends OpenAPIRoute {
    schema = {
        tags: ["Subscriptions"],
        summary:
            "Create a payment checkout for a Techabanca Billing subscription",

        request: {
            body: {
                content: {
                    "application/json": {
                        schema:
                            SubscriptionCheckoutRequest,
                    },
                },
            },
        },

        responses: {
            "200": {
                description:
                    "Existing pending checkout returned",
                content: {
                    "application/json": {
                        schema:
                            CheckoutResponseSchema,
                    },
                },
            },

            "201": {
                description:
                    "Subscription checkout created",
                content: {
                    "application/json": {
                        schema:
                            CheckoutResponseSchema,
                    },
                },
            },

            "400": {
                description:
                    "Selected subscription price is invalid",
            },

            "401": {
                description:
                    "Authentication required",
            },

            "409": {
                description:
                    "Company already has an active subscription",
            },

            "502": {
                description:
                    "Payment provider request failed",
            },
        },
    };

    async handle(c: AppContext) {
        const data =
            await this.getValidatedData<
                typeof this.schema
            >();

        const body = data.body;
        const companyId =
            c.get("companyId");

        if (!companyId) {
            return c.json(
                {
                    success: false,
                    code:
                        "AUTHENTICATION_CONTEXT_MISSING",
                    message:
                        "Authentication context is missing",
                },
                401,
            );
        }

        /*
         * The browser supplies only our internal
         * price ID. Amount, currency, plan and
         * billing interval are always loaded
         * from trusted D1 data.
         */
        const price =
            await getActiveSubscriptionPrice(
                c.env.DB,
                body.price_id,
            );

        if (!price) {
            return c.json(
                {
                    success: false,
                    code:
                        "SUBSCRIPTION_PRICE_INVALID",
                    message:
                        "The selected subscription price is unavailable.",
                },
                400,
            );
        }

        const now =
            new Date().toISOString();

        /*
         * Do not allow a second subscription
         * when the company already has a
         * currently valid active entitlement.
         */
        const activeSubscription =
            await c.env.DB
                .prepare(`
                    SELECT id
                    FROM company_subscriptions
                    WHERE company_id = ?
                        AND status = 'ACTIVE'
                        AND current_period_start IS NOT NULL
                        AND current_period_end IS NOT NULL
                        AND current_period_start <= ?
                        AND current_period_end > ?
                    LIMIT 1
                `)
                .bind(
                    companyId,
                    now,
                    now,
                )
                .first<ExistingActiveSubscription>();

        if (activeSubscription) {
            return c.json(
                {
                    success: false,
                    code:
                        "ACTIVE_SUBSCRIPTION_EXISTS",
                    message:
                        "This company already has an active Techabanca Billing subscription.",
                },
                409,
            );
        }

        /*
         * Reuse an already-created Razorpay
         * subscription for the same Techabanca Billing
         * price. This protects against repeated
         * clicks and page reloads.
         */
        const existingPending =
            await c.env.DB
                .prepare(`
                    SELECT
                        id,
                        provider_subscription_id
                    FROM company_subscriptions
                    WHERE company_id = ?
                        AND price_id = ?
                        AND status = 'PENDING_PAYMENT'
                        AND provider = 'RAZORPAY'
                        AND provider_subscription_id
                            IS NOT NULL
                    ORDER BY created_at DESC
                    LIMIT 1
                `)
                .bind(
                    companyId,
                    price.id,
                )
                .first<ExistingPendingSubscription>();

        if (existingPending) {
            return c.json({
                success: true,

                checkout: {
                    subscription_id:
                        existingPending.id,

                    provider:
                        "RAZORPAY" as const,

                    provider_subscription_id:
                        existingPending
                            .provider_subscription_id,

                    provider_key_id:
                        c.env.RAZORPAY_KEY_ID,

                    price_id:
                        price.id,

                    billing_interval:
                        price.billing_interval,

                    amount_paise:
                        price.amount_paise,

                    currency_code:
                        price.currency_code,

                    plan_name:
                        price.plan_name,
                },
            });
        }

        let providerPlanId: string;

        try {
            providerPlanId =
                await ensureRazorpayPlan(
                    c.env,
                    price,
                );
        } catch (error) {
            if (
                error instanceof
                RazorpayRequestError
            ) {
                console.error(
                    "Razorpay plan provisioning failed",
                    {
                        status:
                            error.status,
                        message:
                            error.message,
                    },
                );
            } else {
                console.error(
                    "Subscription plan provisioning failed",
                    error,
                );
            }

            return c.json(
                {
                    success: false,
                    code:
                        "PAYMENT_PROVIDER_ERROR",
                    message:
                        "Unable to start the payment process. Please try again.",
                },
                502,
            );
        }

        const subscriptionId =
            crypto.randomUUID();

        const totalCount =
            getSubscriptionTotalCount(
                price.billing_interval,
            );

        /*
         * Create the local row first so we
         * already have an internal subscription
         * ID that can be included in Razorpay
         * notes and later webhook processing.
         */
        await c.env.DB
            .prepare(`
                INSERT INTO company_subscriptions (
                    id,
                    company_id,
                    plan_id,
                    price_id,
                    billing_interval,
                    status,
                    amount_paise,
                    currency_code,
                    provider,
                    cancel_at_period_end,
                    created_at,
                    updated_at
                )
                VALUES (
                    ?, ?, ?, ?, ?,
                    'PENDING_PAYMENT',
                    ?, ?,
                    'RAZORPAY',
                    0,
                    ?, ?
                )
            `)
            .bind(
                subscriptionId,
                companyId,
                price.plan_id,
                price.id,
                price.billing_interval,
                price.amount_paise,
                price.currency_code,
                now,
                now,
            )
            .run();

        try {
            const providerSubscription =
                await createRazorpaySubscription(
                    c.env,
                    {
                        planId:
                            providerPlanId,

                        totalCount,

                        /*
                         * Techabanca Billing owns the checkout
                         * experience, so Razorpay
                         * should not separately send
                         * subscription checkout
                         * notifications here.
                         */
                        customerNotify:
                            false,

                        notes: {
                            taxlume_subscription_id:
                                subscriptionId,

                            company_id:
                                companyId,

                            price_id:
                                price.id,
                        },
                    },
                );

            const updatedAt =
                new Date().toISOString();

            await c.env.DB
                .prepare(`
                    UPDATE company_subscriptions
                    SET
                        provider_subscription_id = ?,
                        updated_at = ?
                    WHERE id = ?
                        AND company_id = ?
                        AND status =
                            'PENDING_PAYMENT'
                `)
                .bind(
                    providerSubscription.id,
                    updatedAt,
                    subscriptionId,
                    companyId,
                )
                .run();

            return c.json(
                {
                    success: true,

                    checkout: {
                        subscription_id:
                            subscriptionId,

                        provider:
                            "RAZORPAY" as const,

                        provider_subscription_id:
                            providerSubscription.id,

                        /*
                         * Razorpay's Key ID is the
                         * publishable identifier used
                         * by Checkout. The Key Secret
                         * is never returned.
                         */
                        provider_key_id:
                            c.env.RAZORPAY_KEY_ID,

                        price_id:
                            price.id,

                        billing_interval:
                            price.billing_interval,

                        amount_paise:
                            price.amount_paise,

                        currency_code:
                            price.currency_code,

                        plan_name:
                            price.plan_name,
                    },
                },
                201,
            );
        } catch (error) {
            /*
             * If Razorpay did not create the
             * subscription successfully, remove
             * the unfinished local pending row.
             */
            await c.env.DB
                .prepare(`
                    DELETE FROM company_subscriptions
                    WHERE id = ?
                        AND company_id = ?
                        AND status =
                            'PENDING_PAYMENT'
                        AND provider_subscription_id
                            IS NULL
                `)
                .bind(
                    subscriptionId,
                    companyId,
                )
                .run();

            if (
                error instanceof
                RazorpayRequestError
            ) {
                console.error(
                    "Razorpay subscription creation failed",
                    {
                        status:
                            error.status,
                        message:
                            error.message,
                    },
                );
            } else {
                console.error(
                    "Subscription checkout failed",
                    error,
                );
            }

            return c.json(
                {
                    success: false,
                    code:
                        "PAYMENT_PROVIDER_ERROR",
                    message:
                        "Unable to start the payment process. Please try again.",
                },
                502,
            );
        }
    }
}