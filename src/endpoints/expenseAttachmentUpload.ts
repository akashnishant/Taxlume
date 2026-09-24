import { OpenAPIRoute } from "chanfana";
import { z } from "zod";
import type { AppContext } from "../types";
import { prepareAuditLog } from "../utils/audit/auditLog";

const MAX_RECEIPT_SIZE =
    10 * 1024 * 1024;

const ALLOWED_RECEIPT_TYPES =
    new Set([
        "application/pdf",
        "image/png",
        "image/jpeg",
        "image/webp",
    ]);

function extensionForContentType(
    contentType: string,
): string {
    switch (contentType) {
        case "application/pdf":
            return "pdf";

        case "image/png":
            return "png";

        case "image/webp":
            return "webp";

        case "image/jpeg":
        default:
            return "jpg";
    }
}

function normalizeFilename(
    filename: string,
): string {
    const value =
        filename
            .replace(/[\u0000-\u001F\u007F]/g, "")
            .trim();

    if (!value) {
        return "receipt";
    }

    return value.slice(0, 255);
}

export class ExpenseAttachmentUpload
    extends OpenAPIRoute {

    schema = {
        tags: ["Expenses"],
        summary:
            "Upload a receipt attachment for an expense",

        request: {
            params: z.object({
                id: z.string().uuid(),
            }),
        },

        responses: {
            "201": {
                description:
                    "Expense receipt uploaded successfully",
            },

            "400": {
                description:
                    "Invalid attachment",
            },

            "401": {
                description:
                    "Authentication required",
            },

            "404": {
                description:
                    "Expense not found",
            },
        },
    };

    async handle(c: AppContext) {
        const companyId =
            c.get("companyId");

        const userId =
            c.get("userId");

        const expenseId =
            c.req.param("id");

        if (!companyId || !userId) {
            return c.json(
                {
                    success: false,
                    message:
                        "Authentication context is missing",
                },
                401,
            );
        }

        if (
            !expenseId ||
            !z.string()
                .uuid()
                .safeParse(expenseId)
                .success
        ) {
            return c.json(
                {
                    success: false,
                    message:
                        "Invalid expense ID",
                },
                400,
            );
        }

        /*
         * Attachments may only be added to a currently
         * visible expense owned by this company.
         */
        const expense =
            await c.env.DB
                .prepare(`
                    SELECT id
                    FROM expenses
                    WHERE id = ?
                      AND company_id = ?
                      AND deleted_at IS NULL
                    LIMIT 1
                `)
                .bind(
                    expenseId,
                    companyId,
                )
                .first<{
                    id: string;
                }>();

        if (!expense) {
            return c.json(
                {
                    success: false,
                    message:
                        "Expense not found",
                },
                404,
            );
        }

        const requestContentType =
            c.req.header("Content-Type") ??
            "";

        if (
            !requestContentType
                .toLowerCase()
                .startsWith(
                    "multipart/form-data",
                )
        ) {
            return c.json(
                {
                    success: false,
                    message:
                        "Content-Type must be multipart/form-data",
                },
                400,
            );
        }

        const formData =
            await c.req.formData();

        const fileValue =
            formData.get("file");

        if (!(fileValue instanceof File)) {
            return c.json(
                {
                    success: false,
                    message:
                        "Receipt file is required",
                },
                400,
            );
        }

        if (fileValue.size <= 0) {
            return c.json(
                {
                    success: false,
                    message:
                        "Receipt file cannot be empty",
                },
                400,
            );
        }

        if (
            fileValue.size >
            MAX_RECEIPT_SIZE
        ) {
            return c.json(
                {
                    success: false,
                    message:
                        "Receipt file must not exceed 10 MB",
                },
                400,
            );
        }

        const contentType =
            fileValue.type
                .toLowerCase()
                .trim();

        if (
            !ALLOWED_RECEIPT_TYPES.has(
                contentType,
            )
        ) {
            return c.json(
                {
                    success: false,
                    message:
                        "Receipt must be a PDF, PNG, JPEG, or WebP file",
                },
                400,
            );
        }

        const attachmentId =
            crypto.randomUUID();

        const extension =
            extensionForContentType(
                contentType,
            );

        const objectKey =
            `company-files/${companyId}/expenses/${expenseId}/attachments/${attachmentId}.${extension}`;

        const originalFilename =
            normalizeFilename(
                fileValue.name,
            );

        /*
         * Write R2 first. If D1 or audit persistence fails,
         * the object is removed again below.
         */
        await c.env.billdesk_files.put(
            objectKey,
            fileValue.stream(),
            {
                httpMetadata: {
                    contentType,
                    cacheControl:
                        "private, no-store",
                },

                customMetadata: {
                    companyId,
                    expenseId,
                    attachmentId,
                    purpose:
                        "expense-receipt",
                },
            },
        );

        const now =
            new Date().toISOString();

        const insertStatement =
            c.env.DB
                .prepare(`
                    INSERT INTO expense_attachments (
                        id,
                        company_id,
                        expense_id,
                        object_key,
                        original_filename,
                        content_type,
                        size_bytes,
                        created_by,
                        created_at
                    )
                    VALUES (
                        ?, ?, ?, ?, ?, ?, ?, ?, ?
                    )
                `)
                .bind(
                    attachmentId,
                    companyId,
                    expenseId,
                    objectKey,
                    originalFilename,
                    contentType,
                    fileValue.size,
                    userId,
                    now,
                );

        const auditStatement =
            prepareAuditLog(
                c.env.DB,
                {
                    companyId,
                    userId,

                    entityType:
                        "EXPENSE_ATTACHMENT",

                    entityId:
                        attachmentId,

                    action:
                        "CREATED",

                    metadata: {
                        expense_id:
                            expenseId,

                        original_filename:
                            originalFilename,

                        content_type:
                            contentType,

                        size_bytes:
                            fileValue.size,

                        object_key:
                            objectKey,
                    },
                },
            );

        try {
            const results =
                await c.env.DB.batch([
                    insertStatement,
                    auditStatement,
                ]);

            if (
                !results[0]?.success ||
                results[0]
                    .meta
                    .changes !== 1 ||
                !results[1]?.success
            ) {
                await c.env
                    .billdesk_files
                    .delete(
                        objectKey,
                    );

                return c.json(
                    {
                        success: false,
                        message:
                            "Receipt attachment could not be saved",
                    },
                    400,
                );
            }
        } catch (error) {
            try {
                await c.env
                    .billdesk_files
                    .delete(
                        objectKey,
                    );
            } catch {
                /*
                 * Preserve the original D1 error.
                 * Any orphan cleanup can be handled separately.
                 */
            }

            throw error;
        }

        return c.json(
            {
                success: true,

                message:
                    "Receipt uploaded successfully",

                attachment: {
                    id:
                        attachmentId,

                    expense_id:
                        expenseId,

                    original_filename:
                        originalFilename,

                    content_type:
                        contentType,

                    size_bytes:
                        fileValue.size,

                    created_by:
                        userId,

                    created_at:
                        now,
                },
            },
            201,
        );
    }
}
