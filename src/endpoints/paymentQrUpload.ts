import { OpenAPIRoute } from "chanfana";
import { z } from "zod";
import type { AppContext } from "../types";
import { prepareAuditLog } from "../utils/audit/auditLog";

const MAX_QR_SIZE = 2 * 1024 * 1024;

const ALLOWED_QR_TYPES = new Set([
    "image/png",
    "image/jpeg",
    "image/webp",
]);

export class PaymentQrUpload extends OpenAPIRoute {
    schema = {
        tags: ["Company Payment Details"],
        summary: "Upload company payment QR code",
        responses: {
            "200": {
                description:
                    "Payment QR code uploaded successfully",
                content: {
                    "application/json": {
                        schema: z.object({
                            success: z.boolean(),
                            message: z.string(),
                            qr_code_key: z.string(),
                        }),
                    },
                },
            },
        },
    };

    async handle(c: AppContext) {
        const companyId = c.get("companyId");
        const userId = c.get("userId");

        const contentType =
            c.req.header("Content-Type") ?? "";

        if (
            !contentType
                .toLowerCase()
                .startsWith("multipart/form-data")
        ) {
            return c.json(
                {
                    success: false,
                    message:
                        "Content-Type must be multipart/form-data.",
                },
                400,
            );
        }

        const formData =
            await c.req.formData();

        const fileValue =
            formData.get("qr_code");

        if (!(fileValue instanceof File)) {
            return c.json(
                {
                    success: false,
                    message:
                        "QR code image is required.",
                },
                400,
            );
        }

        if (fileValue.size <= 0) {
            return c.json(
                {
                    success: false,
                    message:
                        "QR code image cannot be empty.",
                },
                400,
            );
        }

        if (fileValue.size > MAX_QR_SIZE) {
            return c.json(
                {
                    success: false,
                    message:
                        "QR code image must not exceed 2 MB.",
                },
                400,
            );
        }

        if (
            !ALLOWED_QR_TYPES.has(
                fileValue.type.toLowerCase(),
            )
        ) {
            return c.json(
                {
                    success: false,
                    message:
                        "QR code must be a PNG, JPEG, or WebP image.",
                },
                400,
            );
        }

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

        if (!existing) {
            return c.json(
                {
                    success: false,
                    message:
                        "Payment details must be saved before uploading a QR code.",
                },
                400,
            );
        }

        const extension =
            fileValue.type === "image/png"
                ? "png"
                : fileValue.type === "image/webp"
                    ? "webp"
                    : "jpg";

        const objectKey =
            `company-files/${companyId}/payment-qr/${crypto.randomUUID()}.${extension}`;

        await c.env.billdesk_files.put(
            objectKey,
            fileValue.stream(),
            {
                httpMetadata: {
                    contentType:
                        fileValue.type,
                    cacheControl:
                        "private, max-age=31536000",
                },
                customMetadata: {
                    companyId,
                    purpose: "payment-qr",
                },
            },
        );

        const now =
            new Date().toISOString();

        const updateStatement =
            c.env.DB
                .prepare(`
                    UPDATE company_payment_details
                    SET
                        qr_code_key = ?,
                        updated_at = ?
                    WHERE
                        id = ?
                        AND company_id = ?
                `)
                .bind(
                    objectKey,
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
                    "PAYMENT_QR_UPLOADED",
                metadata: {
                    previous_qr_code_key:
                        existing.qr_code_key,
                    new_qr_code_key:
                        objectKey,
                    content_type:
                        fileValue.type,
                    file_size:
                        fileValue.size,
                },
            });

        try {
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
                await c.env.billdesk_files.delete(
                    objectKey,
                );

                return c.json(
                    {
                        success: false,
                        message:
                            "Payment QR code could not be saved.",
                    },
                    400,
                );
            }
        } catch (error) {
            await c.env.billdesk_files.delete(
                objectKey,
            );

            throw error;
        }

        if (
            existing.qr_code_key &&
            existing.qr_code_key !== objectKey
        ) {
            try {
                await c.env.billdesk_files.delete(
                    existing.qr_code_key,
                );
            } catch {
                // The new QR is already active in D1.
                // Failure to remove the old object should
                // not invalidate the successful replacement.
            }
        }

        return c.json({
            success: true,
            message:
                "Payment QR code uploaded successfully",
            qr_code_key: objectKey,
        });
    }
}