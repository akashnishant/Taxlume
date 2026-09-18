import { OpenAPIRoute } from "chanfana";
import { z } from "zod";
import type { AppContext } from "../types";
import { prepareAuditLog } from "../utils/audit/auditLog";

export class PaymentQrDelete extends OpenAPIRoute {
    schema = {
        tags: ["Company Payment Details"],
        summary: "Delete company payment QR code",
        responses: {
            "200": {
                description:
                    "Payment QR code deleted successfully",
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
                        qr_code_key
                    FROM company_payment_details
                    WHERE company_id = ?
                    LIMIT 1
                `)
                .bind(companyId)
                .first<{
                    id: string;
                    qr_code_key: string | null;
                }>();

        if (
            !existing ||
            !existing.qr_code_key
        ) {
            return c.json({
                success: true,
                message:
                    "Payment QR code is already removed.",
            });
        }

        const previousQrCodeKey =
            existing.qr_code_key;

        const now =
            new Date().toISOString();

        const updateStatement =
            c.env.DB
                .prepare(`
                    UPDATE company_payment_details
                    SET
                        qr_code_key = NULL,
                        updated_at = ?
                    WHERE
                        id = ?
                        AND company_id = ?
                `)
                .bind(
                    now,
                    existing.id,
                    companyId,
                );

        const auditStatement =
            prepareAuditLog(c.env.DB, {
                companyId,
                userId,
                entityType:
                    "COMPANY_PAYMENT_DETAILS",
                entityId: existing.id,
                action:
                    "PAYMENT_QR_DELETED",
                metadata: {
                    previous_qr_code_key:
                        previousQrCodeKey,
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
                        "Payment QR code could not be removed.",
                },
                400,
            );
        }

        try {
            await c.env.billdesk_files.delete(
                previousQrCodeKey,
            );
        } catch {
            // D1 is already cleared, so the QR can no longer
            // be used by the application. R2 cleanup failure
            // should not make the successful deletion appear
            // to have failed.
        }

        return c.json({
            success: true,
            message:
                "Payment QR code deleted successfully.",
        });
    }
}