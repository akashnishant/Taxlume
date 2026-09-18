import { OpenAPIRoute } from "chanfana";
import { z } from "zod";
import type { AppContext } from "../types";
import { prepareAuditLog } from "../utils/audit/auditLog";

const MAX_SIGNATURE_SIZE = 2 * 1024 * 1024;

const ALLOWED_SIGNATURE_TYPES = new Set([
    "image/png",
    "image/jpeg",
    "image/webp",
]);

export class CompanySignatureUpload extends OpenAPIRoute {
    schema = {
        tags: ["Company"],
        summary: "Upload authorized signature image",
        responses: {
            "200": {
                description:
                    "Authorized signature uploaded successfully",
                content: {
                    "application/json": {
                        schema: z.object({
                            success: z.boolean(),
                            message: z.string(),
                            signature_key: z.string(),
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
            formData.get("signature");

        if (!(fileValue instanceof File)) {
            return c.json(
                {
                    success: false,
                    message:
                        "Signature image is required.",
                },
                400,
            );
        }

        if (fileValue.size <= 0) {
            return c.json(
                {
                    success: false,
                    message:
                        "Signature image cannot be empty.",
                },
                400,
            );
        }

        if (fileValue.size > MAX_SIGNATURE_SIZE) {
            return c.json(
                {
                    success: false,
                    message:
                        "Signature image must not exceed 2 MB.",
                },
                400,
            );
        }

        if (
            !ALLOWED_SIGNATURE_TYPES.has(
                fileValue.type.toLowerCase(),
            )
        ) {
            return c.json(
                {
                    success: false,
                    message:
                        "Signature must be a PNG, JPEG, or WebP image.",
                },
                400,
            );
        }

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

        if (!existing) {
            return c.json(
                {
                    success: false,
                    message: "Company not found.",
                },
                404,
            );
        }

        const extension =
            fileValue.type === "image/png"
                ? "png"
                : fileValue.type === "image/webp"
                    ? "webp"
                    : "jpg";

        const objectKey =
            `company-files/${companyId}/signature/${crypto.randomUUID()}.${extension}`;

        await c.env.billdesk_files.put(
            objectKey,
            fileValue.stream(),
            {
                httpMetadata: {
                    contentType: fileValue.type,
                    cacheControl:
                        "private, max-age=31536000",
                },
                customMetadata: {
                    companyId,
                    purpose:
                        "authorized-signature",
                },
            },
        );

        const now =
            new Date().toISOString();

        const updateStatement =
            c.env.DB
                .prepare(`
                    UPDATE companies
                    SET
                        signature_key = ?,
                        updated_at = ?
                    WHERE
                        id = ?
                        AND is_active = 1
                `)
                .bind(
                    objectKey,
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
                    "SIGNATURE_UPLOADED",
                metadata: {
                    previous_signature_key:
                        existing.signature_key,
                    new_signature_key:
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
                            "Authorized signature could not be saved.",
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
            existing.signature_key &&
            existing.signature_key !== objectKey
        ) {
            try {
                await c.env.billdesk_files.delete(
                    existing.signature_key,
                );
            } catch {
                // The new signature is already active in D1.
                // Failure to remove the previous R2 object
                // should not invalidate the successful replacement.
            }
        }

        return c.json({
            success: true,
            message:
                "Authorized signature uploaded successfully",
            signature_key: objectKey,
        });
    }
}