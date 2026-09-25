import type { AuditLogInput } from "../audit/auditLog";

/*
 * Use immediately after a conditional recurring-rule UPDATE
 * in the same D1 batch.
 *
 * A zero-row UPDATE must not create an audit.
 */
export function prepareConditionalRecurringAudit(
    db: D1Database,
    input: AuditLogInput,
): D1PreparedStatement {
    return db
        .prepare(`
            INSERT INTO audit_logs (
                id,
                company_id,
                user_id,
                entity_type,
                entity_id,
                action,
                metadata_json,
                created_at
            )
            SELECT
                ?, ?, ?, ?, ?, ?, ?, ?
            WHERE changes() = 1
        `)
        .bind(
            crypto.randomUUID(),
            input.companyId,
            input.userId,
            input.entityType,
            input.entityId,
            input.action,
            input.metadata
                ? JSON.stringify(input.metadata)
                : null,
            new Date().toISOString(),
        );
}
