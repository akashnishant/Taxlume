import { OpenAPIRoute } from "chanfana";
import { z } from "zod";
import type { AppContext } from "../types";
import { prepareAuditLog } from "../utils/audit/auditLog";

export class CompanySignatureDelete extends OpenAPIRoute {
    schema = {
        tags: ["Company"],
        summary: "Delete authorized signature image",
        responses: {
            "200": {
                description:
                    "Authorized signature deleted successfully",
                content: {
                    "application/json": {
                        schema: z.object({
                            success: z.boolean(),
                            message: z.string(),
                        }),
                    },
                },
            },
        },
    };

    async handle(c: AppContext) {
        const companyId = c.get("companyId");
        const userId = c.get("userId");

        const existing =
            await c.env.DB
                .prepare(`
                    SELECT
                        id,
                        signature_key
                    FROM companies
                    WHERE
                        id = ?
                        AND is_active = 1
                    LIMIT 1
                `)
                .bind(companyId)
                .first<{
                    id: string;
                    signature_key: string | null;
                }>();

        if (
            !existing ||
            !existing.signature_key
        ) {
            return c.json({
                success: true,
                message:
                    "Authorized signature is already removed.",
            });
        }

        const previousSignatureKey =
            existing.signature_key;

        const now =
            new Date().toISOString();

        const updateStatement =
            c.env.DB
                .prepare(`
                    UPDATE companies
                    SET
                        signature_key = NULL,
                        updated_at = ?
                    WHERE
                        id = ?
                        AND is_active = 1
                `)
                .bind(
                    now,
                    companyId,
                );

        const auditStatement =
            prepareAuditLog(c.env.DB, {
                companyId,
                userId,
                entityType: "COMPANY",
                entityId: companyId,
                action:
                    "SIGNATURE_DELETED",
                metadata: {
                    previous_signature_key:
                        previousSignatureKey,
                },
            });

        const results =
            await c.env.DB.batch([
                updateStatement,
                auditStatement,
            ]);

        const updateResult =
            results[0];

        const auditResult =
            results[1];

        if (
            !updateResult ||
            !auditResult ||
            !updateResult.success ||
            updateResult.meta.changes !== 1 ||
            !auditResult.success
        ) {
            return c.json(
                {
                    success: false,
                    message:
                        "Authorized signature could not be removed.",
                },
                400,
            );
        }

        try {
            await c.env.billdesk_files.delete(
                previousSignatureKey,
            );
        } catch {
            // D1 is already cleared, so the signature can no longer
            // be used by the application. R2 cleanup failure should
            // not make the successful deletion appear to have failed.
        }

        return c.json({
            success: true,
            message:
                "Authorized signature deleted successfully.",
        });
    }
}