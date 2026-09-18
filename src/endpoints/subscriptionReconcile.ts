import { OpenAPIRoute } from "chanfana";
import { z } from "zod";
import { type AppContext } from "../types";
import {
    fetchRazorpaySubscription,
} from "../payments/razorpaySubscriptions";
import {
    RazorpayRequestError,
} from "../payments/razorpayClient";
import {
    applyRazorpaySubscriptionState,
} from "../subscriptions/applyRazorpaySubscriptionState";

type LocalSubscriptionRow = {
    id: string;
    provider_subscription_id: string;

    status:
        | "PENDING_PAYMENT"
        | "ACTIVE"
        | "PAST_DUE"
        | "CANCELLED"
        | "EXPIRED";
};

type UpdatedSubscriptionRow = {
    id: string;

    status:
        | "PENDING_PAYMENT"
        | "ACTIVE"
        | "PAST_DUE"
        | "CANCELLED"
        | "EXPIRED";

    provider_status: string | null;

    current_period_start: string | null;
    current_period_end: string | null;

    provider_event_created_at: number | null;
    provider_event_id: string | null;
};

export class SubscriptionReconcile extends OpenAPIRoute {
    schema = {
        tags: ["Subscriptions"],

        summary:
            "Reconcile the authenticated company's subscription with Razorpay",

        responses: {
            "200": {
                description:
                    "Subscription reconciled successfully",

                content: {
                    "application/json": {
                        schema: z.object({
                            success: z.boolean(),

                            applied: z.boolean(),

                            provider_status:
                                z.string(),

                            subscription:
                                z.object({
                                    id: z.string(),

                                    status: z.enum([
                                        "PENDING_PAYMENT",
                                        "ACTIVE",
                                        "PAST_DUE",
                                        "CANCELLED",
                                        "EXPIRED",
                                    ]),

                                    current_period_start:
                                        z.string().nullable(),

                                    current_period_end:
                                        z.string().nullable(),
                                }),
                        }),
                    },
                },
            },

            "401": {
                description:
                    "Authentication required",
            },

            "404": {
                description:
                    "No Razorpay subscription found",
            },

            "502": {
                description:
                    "Unable to fetch subscription from Razorpay",
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

        /*
         * Never accept a Razorpay subscription ID
         * from the browser.
         *
         * Resolve it using the authenticated
         * company's own local subscription row.
         */
        const localSubscription =
            await c.env.DB
                .prepare(`
                    SELECT
                        id,
                        provider_subscription_id,
                        status

                    FROM company_subscriptions

                    WHERE company_id = ?
                        AND provider = 'RAZORPAY'
                        AND provider_subscription_id
                            IS NOT NULL

                    ORDER BY created_at DESC

                    LIMIT 1
                `)
                .bind(companyId)
                .first<LocalSubscriptionRow>();

        if (!localSubscription) {
            return c.json(
                {
                    success: false,
                    code:
                        "RAZORPAY_SUBSCRIPTION_NOT_FOUND",
                    message:
                        "No Razorpay subscription is available to reconcile.",
                },
                404,
            );
        }

        let providerSubscription;

        try {
            providerSubscription =
                await fetchRazorpaySubscription(
                    c.env,
                    localSubscription
                        .provider_subscription_id,
                );
        } catch (error) {
            if (
                error instanceof
                RazorpayRequestError
            ) {
                console.error(
                    "Razorpay subscription reconciliation fetch failed",
                    {
                        status:
                            error.status,

                        message:
                            error.message,

                        providerSubscriptionId:
                            localSubscription
                                .provider_subscription_id,
                    },
                );
            } else {
                console.error(
                    "Subscription reconciliation failed",
                    error,
                );
            }

            return c.json(
                {
                    success: false,
                    code:
                        "PAYMENT_PROVIDER_ERROR",
                    message:
                        "Unable to verify the subscription with Razorpay. Please try again.",
                },
                502,
            );
        }

        /*
         * A reconciliation is an authoritative
         * provider-state snapshot taken now.
         *
         * Using the current Unix time means an
         * older delayed webhook cannot overwrite
         * this newer provider state later.
         */
        const reconciliationTime =
            Math.floor(
                Date.now() / 1000,
            );

        const reconciliationId =
            `reconcile:${crypto.randomUUID()}`;

        const result =
            await applyRazorpaySubscriptionState(
                c.env.DB,
                {
                    eventId:
                        reconciliationId,

                    eventCreatedAt:
                        reconciliationTime,

                    subscription: {
                        id:
                            providerSubscription.id,

                        status:
                            providerSubscription.status,

                        current_start:
                            providerSubscription
                                .current_start,

                        current_end:
                            providerSubscription
                                .current_end,

                        ended_at:
                            providerSubscription
                                .ended_at,
                    },
                },
            );

        const updatedSubscription =
            await c.env.DB
                .prepare(`
                    SELECT
                        id,
                        status,
                        provider_status,
                        current_period_start,
                        current_period_end,
                        provider_event_created_at,
                        provider_event_id

                    FROM company_subscriptions

                    WHERE id = ?
                        AND company_id = ?

                    LIMIT 1
                `)
                .bind(
                    localSubscription.id,
                    companyId,
                )
                .first<UpdatedSubscriptionRow>();

        if (!updatedSubscription) {
            /*
             * This should never occur because the
             * row was resolved immediately above.
             */
            return c.json(
                {
                    success: false,
                    message:
                        "Subscription reconciliation could not be completed.",
                },
                500,
            );
        }

        return c.json({
            success: true,

            applied:
                result.applied,

            provider_status:
                providerSubscription.status,

            subscription: {
                id:
                    updatedSubscription.id,

                status:
                    updatedSubscription.status,

                current_period_start:
                    updatedSubscription
                        .current_period_start,

                current_period_end:
                    updatedSubscription
                        .current_period_end,
            },
        });
    }
}