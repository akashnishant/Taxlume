export type PaymentWebhookEventStatus =
    | "RECEIVED"
    | "PROCESSED"
    | "FAILED";

export type PaymentWebhookEventRow = {
    id: string;
    provider: string;
    provider_event_id: string;
    event_type: string;
    status: PaymentWebhookEventStatus;
    payload_json: string;
    attempt_count: number;
    error_message: string | null;
    received_at: string;
    processed_at: string | null;
    created_at: string;
    updated_at: string;
};

export async function recordWebhookEvent(
    db: D1Database,
    input: {
        provider: string;
        providerEventId: string;
        eventType: string;
        payloadJson: string;
    },
): Promise<{
    event: PaymentWebhookEventRow;
    isNew: boolean;
}> {
    const now =
        new Date().toISOString();

    const id =
        crypto.randomUUID();

    const result =
        await db
            .prepare(`
                INSERT OR IGNORE INTO payment_webhook_events (
                    id,
                    provider,
                    provider_event_id,
                    event_type,
                    status,
                    payload_json,
                    attempt_count,
                    error_message,
                    received_at,
                    processed_at,
                    created_at,
                    updated_at
                )
                VALUES (
                    ?, ?, ?, ?,
                    'RECEIVED',
                    ?,
                    0,
                    NULL,
                    ?,
                    NULL,
                    ?,
                    ?
                )
            `)
            .bind(
                id,
                input.provider,
                input.providerEventId,
                input.eventType,
                input.payloadJson,
                now,
                now,
                now,
            )
            .run();

    const event =
        await db
            .prepare(`
                SELECT
                    id,
                    provider,
                    provider_event_id,
                    event_type,
                    status,
                    payload_json,
                    attempt_count,
                    error_message,
                    received_at,
                    processed_at,
                    created_at,
                    updated_at
                FROM payment_webhook_events
                WHERE provider = ?
                    AND provider_event_id = ?
                LIMIT 1
            `)
            .bind(
                input.provider,
                input.providerEventId,
            )
            .first<PaymentWebhookEventRow>();

    if (!event) {
        throw new Error(
            "Unable to persist payment webhook event.",
        );
    }

    return {
        event,
        isNew:
            (result.meta.changes ?? 0) > 0,
    };
}

export async function markWebhookEventProcessed(
    db: D1Database,
    eventId: string,
): Promise<void> {
    const now =
        new Date().toISOString();

    await db
        .prepare(`
            UPDATE payment_webhook_events
            SET
                status = 'PROCESSED',
                attempt_count =
                    attempt_count + 1,
                error_message = NULL,
                processed_at = ?,
                updated_at = ?
            WHERE id = ?
        `)
        .bind(
            now,
            now,
            eventId,
        )
        .run();
}

export async function markWebhookEventFailed(
    db: D1Database,
    eventId: string,
    errorMessage: string,
): Promise<void> {
    const now =
        new Date().toISOString();

    await db
        .prepare(`
            UPDATE payment_webhook_events
            SET
                status = 'FAILED',
                attempt_count =
                    attempt_count + 1,
                error_message = ?,
                updated_at = ?
            WHERE id = ?
        `)
        .bind(
            errorMessage,
            now,
            eventId,
        )
        .run();
}