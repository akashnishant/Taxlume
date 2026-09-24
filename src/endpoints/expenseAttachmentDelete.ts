import { OpenAPIRoute } from "chanfana";
import { z } from "zod";
import type { AppContext } from "../types";
import { prepareAuditLog } from "../utils/audit/auditLog";

type AttachmentRow = {
    id: string;
    object_key: string;
    original_filename: string;
    content_type: string;
    size_bytes: number;
};

export class ExpenseAttachmentDelete
    extends OpenAPIRoute {

    schema = {
        tags: ["Expenses"],
        summary:
            "Delete an expense receipt attachment",

        request: {
            params: z.object({
                id: z.string().uuid(),
                attachmentId:
                    z.string().uuid(),
            }),
        },

        responses: {
            "200": {
                description:
                    "Expense attachment deleted successfully",
            },

            "400": {
                description:
                    "Invalid expense or attachment ID",
            },

            "401": {
                description:
                    "Authentication required",
            },

            "404": {
                description:
                    "Expense attachment not found",
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

        const attachmentId =
            c.req.param(
                "attachmentId",
            );

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

        if (
            !attachmentId ||
            !z.string()
                .uuid()
                .safeParse(attachmentId)
                .success
        ) {
            return c.json(
                {
                    success: false,
                    message:
                        "Invalid attachment ID",
                },
                400,
            );
        }

        /*
         * Attachments can only be managed while their
         * parent expense is active/visible.
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

        const attachment =
            await c.env.DB
                .prepare(`
                    SELECT
                        id,
                        object_key,
                        original_filename,
                        content_type,
                        size_bytes

                    FROM expense_attachments

                    WHERE id = ?
                      AND company_id = ?
                      AND expense_id = ?
                      AND deleted_at IS NULL

                    LIMIT 1
                `)
                .bind(
                    attachmentId,
                    companyId,
                    expenseId,
                )
                .first<AttachmentRow>();

        if (!attachment) {
            return c.json(
                {
                    success: false,
                    message:
                        "Expense attachment not found",
                },
                404,
            );
        }

        const now =
            new Date().toISOString();

        const deleteStatement =
            c.env.DB
                .prepare(`
                    UPDATE expense_attachments

                    SET
                        deleted_by = ?,
                        deleted_at = ?

                    WHERE id = ?
                      AND company_id = ?
                      AND expense_id = ?
                      AND deleted_at IS NULL
                `)
                .bind(
                    userId,
                    now,
                    attachmentId,
                    companyId,
                    expenseId,
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
                        "DELETED",

                    metadata: {
                        expense_id:
                            expenseId,

                        original_filename:
                            attachment
                                .original_filename,

                        content_type:
                            attachment
                                .content_type,

                        size_bytes:
                            attachment
                                .size_bytes,

                        object_key:
                            attachment
                                .object_key,
                    },
                },
            );

        const results =
            await c.env.DB.batch([
                deleteStatement,
                auditStatement,
            ]);

        if (
            !results[0]?.success ||
            results[0]
                .meta
                .changes !== 1 ||
            !results[1]?.success
        ) {
            return c.json(
                {
                    success: false,
                    message:
                        "Expense attachment could not be deleted",
                },
                400,
            );
        }

        /*
         * D1 is now authoritative: the receipt can no longer
         * be listed or downloaded through the application.
         *
         * R2 cleanup is best-effort, matching the existing
         * private-file deletion convention used elsewhere.
         */
        try {
            await c.env
                .billdesk_files
                .delete(
                    attachment.object_key,
                );
        } catch {
            // Logical deletion has already completed successfully.
        }

        return c.json({
            success: true,

            message:
                "Expense attachment deleted successfully",

            attachment: {
                id:
                    attachmentId,

                expense_id:
                    expenseId,

                deleted_by:
                    userId,

                deleted_at:
                    now,
            },
        });
    }
}
