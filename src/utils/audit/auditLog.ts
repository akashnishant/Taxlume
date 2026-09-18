export type AuditLogInput = {
    companyId: string;
    userId: string;
    entityType: string;
    entityId: string;
    action: string;
    metadata?: Record<string, unknown>;
};

export function prepareAuditLog(
    db: D1Database,
    input: AuditLogInput,
): D1PreparedStatement {
    const now = new Date().toISOString();

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
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
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
            now,
        );
}

export async function createAuditLog(
    db: D1Database,
    input: AuditLogInput,
): Promise<void> {
    await prepareAuditLog(db, input).run();
}