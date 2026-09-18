type RazorpaySubscriptionStatus =
    | "created"
    | "authenticated"
    | "active"
    | "pending"
    | "halted"
    | "cancelled"
    | "completed"
    | "expired";

type TaxlumeSubscriptionStatus =
    | "PENDING_PAYMENT"
    | "ACTIVE"
    | "PAST_DUE"
    | "CANCELLED"
    | "EXPIRED";

export type RazorpayWebhookSubscription = {
    id: string;
    status: RazorpaySubscriptionStatus;

    current_start: number | null;
    current_end: number | null;
    ended_at: number | null;
};

function mapRazorpayStatus(
    status: RazorpaySubscriptionStatus,
): TaxlumeSubscriptionStatus {
    switch (status) {
        case "created":
        case "authenticated":
            return "PENDING_PAYMENT";

        case "active":
            return "ACTIVE";

        case "pending":
        case "halted":
            return "PAST_DUE";

        case "cancelled":
            return "CANCELLED";

        case "completed":
        case "expired":
            return "EXPIRED";
    }
}

function unixSecondsToIso(
    value: number | null,
): string | null {
    if (value === null) {
        return null;
    }

    return new Date(
        value * 1000,
    ).toISOString();
}

export async function applyRazorpaySubscriptionState(
    db: D1Database,
    input: {
        eventId: string;
        eventCreatedAt: number;
        subscription: RazorpayWebhookSubscription;
    },
): Promise<{
    applied: boolean;
}> {
    const taxlumeStatus =
        mapRazorpayStatus(
            input.subscription.status,
        );

    const currentPeriodStart =
        unixSecondsToIso(
            input.subscription.current_start,
        );

    const currentPeriodEnd =
        unixSecondsToIso(
            input.subscription.current_end,
        );

    const providerEndedAt =
        unixSecondsToIso(
            input.subscription.ended_at,
        );

    const eventDate =
        new Date(
            input.eventCreatedAt * 1000,
        ).toISOString();

    const now =
        new Date().toISOString();

    /*
     * Webhooks can arrive out of order.
     *
     * Only apply the event when it is at least
     * as recent as the latest provider event
     * already applied to this subscription.
     */
    const result =
        await db
            .prepare(`
                UPDATE company_subscriptions
                SET
                    status = ?,
                    provider_status = ?,

                    started_at =
                        CASE
                            WHEN ? = 'ACTIVE'
                            THEN COALESCE(
                                started_at,
                                ?,
                                ?
                            )
                            ELSE started_at
                        END,

                    current_period_start =
                        COALESCE(
                            ?,
                            current_period_start
                        ),

                    current_period_end =
                        COALESCE(
                            ?,
                            current_period_end
                        ),

                    cancelled_at =
                        CASE
                            WHEN ? = 'CANCELLED'
                            THEN COALESCE(
                                ?,
                                cancelled_at,
                                ?
                            )
                            ELSE cancelled_at
                        END,

                    ended_at =
                        CASE
                            WHEN ? IN (
                                'CANCELLED',
                                'EXPIRED'
                            )
                            THEN COALESCE(
                                ?,
                                ended_at,
                                ?
                            )
                            ELSE ended_at
                        END,

                    provider_event_created_at = ?,
                    provider_event_id = ?,
                    updated_at = ?

                WHERE provider = 'RAZORPAY'
                    AND provider_subscription_id = ?
                    AND (
                        provider_event_created_at IS NULL
                        OR provider_event_created_at <= ?
                    )
            `)
            .bind(
                taxlumeStatus,
                input.subscription.status,

                taxlumeStatus,
                currentPeriodStart,
                eventDate,

                currentPeriodStart,
                currentPeriodEnd,

                taxlumeStatus,
                providerEndedAt,
                eventDate,

                taxlumeStatus,
                providerEndedAt,
                eventDate,

                input.eventCreatedAt,
                input.eventId,
                now,

                input.subscription.id,
                input.eventCreatedAt,
            )
            .run();

    return {
        applied:
            (result.meta.changes ?? 0) > 0,
    };
}