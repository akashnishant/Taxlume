import { z } from "zod";
import { type AppContext } from "../types";
import {
    verifyRazorpayWebhookSignature,
} from "../payments/razorpayWebhook";
import {
    markWebhookEventFailed,
    markWebhookEventProcessed,
    recordWebhookEvent,
} from "../payments/webhookEventRepository";
import {
    applyRazorpaySubscriptionState,
} from "../subscriptions/applyRazorpaySubscriptionState";

const RazorpaySubscriptionStatus = z.enum([
    "created",
    "authenticated",
    "active",
    "pending",
    "halted",
    "cancelled",
    "completed",
    "expired",
]);

const RazorpayWebhookPayload = z
    .object({
        event: z.string().min(1),

        created_at: z
            .number()
            .int()
            .nonnegative(),

        payload: z
            .object({
                subscription: z
                    .object({
                        entity: z
                            .object({
                                id: z
                                    .string()
                                    .min(1),

                                status:
                                    RazorpaySubscriptionStatus,

                                current_start: z
                                    .number()
                                    .int()
                                    .nullable(),

                                current_end: z
                                    .number()
                                    .int()
                                    .nullable(),

                                ended_at: z
                                    .number()
                                    .int()
                                    .nullable(),
                            })
                            .passthrough(),
                    })
                    .optional(),
            })
            .passthrough(),
    })
    .passthrough();

type LocalSubscriptionRow = {
    id: string;
};

export async function razorpayWebhookHandler(
    c: AppContext,
) {
    const webhookSecret =
        c.env.RAZORPAY_WEBHOOK_SECRET;

    if (!webhookSecret) {
        console.error(
            "RAZORPAY_WEBHOOK_SECRET is not configured.",
        );

        return c.json(
            {
                success: false,
                message:
                    "Webhook processing is unavailable.",
            },
            503,
        );
    }

    const signature =
        c.req.header(
            "x-razorpay-signature",
        );

    const providerEventId =
        c.req.header(
            "x-razorpay-event-id",
        );

    if (
        !signature ||
        !providerEventId
    ) {
        return c.json(
            {
                success: false,
                message:
                    "Required Razorpay webhook headers are missing.",
            },
            400,
        );
    }

    /*
     * IMPORTANT:
     *
     * Read the request body as raw text first.
     * Signature verification must happen before
     * JSON parsing or transformation.
     */
    const rawBody =
        await c.req.text();

    const signatureValid =
        await verifyRazorpayWebhookSignature(
            rawBody,
            signature,
            webhookSecret,
        );

    if (!signatureValid) {
        console.warn(
            "Rejected Razorpay webhook with invalid signature.",
            {
                providerEventId,
            },
        );

        return c.json(
            {
                success: false,
                message:
                    "Invalid webhook signature.",
            },
            401,
        );
    }

    let parsedJson: unknown;

    try {
        parsedJson =
            JSON.parse(rawBody);
    } catch {
        const recorded =
            await recordWebhookEvent(
                c.env.DB,
                {
                    provider:
                        "RAZORPAY",

                    providerEventId,

                    eventType:
                        "UNKNOWN",

                    payloadJson:
                        rawBody,
                },
            );

        await markWebhookEventFailed(
            c.env.DB,
            recorded.event.id,
            "Webhook payload is not valid JSON.",
        );

        return c.json(
            {
                success: false,
                message:
                    "Invalid webhook payload.",
            },
            400,
        );
    }

    const validation =
        RazorpayWebhookPayload
            .safeParse(parsedJson);

    /*
     * Even if the payload shape is unexpected,
     * store the verified event so we have an
     * audit trail for debugging.
     */
    const eventType =
        validation.success
            ? validation.data.event
            : (
                typeof parsedJson ===
                    "object" &&
                parsedJson !== null &&
                "event" in parsedJson &&
                typeof (
                    parsedJson as {
                        event?: unknown;
                    }
                ).event === "string"
                    ? (
                        parsedJson as {
                            event: string;
                        }
                    ).event
                    : "UNKNOWN"
            );

    const recorded =
        await recordWebhookEvent(
            c.env.DB,
            {
                provider:
                    "RAZORPAY",

                providerEventId,

                eventType,

                payloadJson:
                    rawBody,
            },
        );

    /*
     * Razorpay can deliver the same event
     * multiple times.
     *
     * Once it was processed successfully,
     * acknowledge subsequent deliveries
     * without applying it again.
     */
    if (
        !recorded.isNew &&
        recorded.event.status ===
            "PROCESSED"
    ) {
        return c.json({
            success: true,
            duplicate: true,
        });
    }

    if (!validation.success) {
        const message =
            validation.error.issues[0]
                ?.message ??
            "Unexpected Razorpay webhook payload.";

        await markWebhookEventFailed(
            c.env.DB,
            recorded.event.id,
            message,
        );

        return c.json(
            {
                success: false,
                message:
                    "Unexpected webhook payload.",
            },
            400,
        );
    }

    const webhook =
        validation.data;

    const subscription =
        webhook.payload
            .subscription
            ?.entity;

    /*
     * We may later subscribe to payment or
     * invoice events as well.
     *
     * A verified event without a subscription
     * entity is safe to acknowledge for now.
     */
    if (!subscription) {
        await markWebhookEventProcessed(
            c.env.DB,
            recorded.event.id,
        );

        return c.json({
            success: true,
            ignored: true,
        });
    }

    try {
        /*
         * Do not silently accept an unknown
         * provider subscription.
         *
         * Returning a failure lets Razorpay
         * retry if the webhook temporarily
         * arrived before our local checkout
         * transaction finished.
         */
        const localSubscription =
            await c.env.DB
                .prepare(`
                    SELECT id
                    FROM company_subscriptions
                    WHERE provider = 'RAZORPAY'
                        AND provider_subscription_id = ?
                    LIMIT 1
                `)
                .bind(
                    subscription.id,
                )
                .first<LocalSubscriptionRow>();

        if (!localSubscription) {
            throw new Error(
                `Unknown Razorpay subscription ${subscription.id}.`,
            );
        }

        const result =
            await applyRazorpaySubscriptionState(
                c.env.DB,
                {
                    eventId:
                        providerEventId,

                    eventCreatedAt:
                        webhook.created_at,

                    subscription,
                },
            );

        await markWebhookEventProcessed(
            c.env.DB,
            recorded.event.id,
        );

        return c.json({
            success: true,
            applied:
                result.applied,
        });
    } catch (error) {
        const message =
            error instanceof Error
                ? error.message
                : "Unknown webhook processing error.";

        console.error(
            "Razorpay webhook processing failed",
            {
                providerEventId,
                eventType:
                    webhook.event,
                message,
            },
        );

        await markWebhookEventFailed(
            c.env.DB,
            recorded.event.id,
            message,
        );

        return c.json(
            {
                success: false,
                message:
                    "Webhook processing failed.",
            },
            500,
        );
    }
}