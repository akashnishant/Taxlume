import { OpenAPIRoute } from "chanfana";
import { z } from "zod";
import type { AppContext } from "../types";

type AttachmentRow = {
    id: string;
    object_key: string;
    original_filename: string;
    content_type: string;
    size_bytes: number;
};

function safeDownloadFilename(
    filename: string,
): string {
    const cleaned =
        filename
            .replace(/[\r\n"]/g, "")
            .replace(/\\/g, "_")
            .trim();

    return cleaned || "receipt";
}

export class ExpenseAttachmentGet
    extends OpenAPIRoute {

    schema = {
        tags: ["Expenses"],
        summary:
            "Download an expense receipt attachment",

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
                    "Expense receipt retrieved successfully",
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

        const expenseId =
            c.req.param("id");

        const attachmentId =
            c.req.param(
                "attachmentId",
            );

        if (!companyId) {
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
         * Require the parent expense to still be visible.
         * This keeps attachment access consistent with
         * Expense Get/List/Update.
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

        const object =
            await c.env.billdesk_files
                .get(
                    attachment.object_key,
                );

        if (!object) {
            return c.json(
                {
                    success: false,
                    message:
                        "Expense attachment file not found",
                },
                404,
            );
        }

        const headers =
            new Headers();

        headers.set(
            "Content-Type",
            attachment.content_type ||
                object.httpMetadata
                    ?.contentType ||
                "application/octet-stream",
        );

        headers.set(
            "Content-Length",
            object.size.toString(),
        );

        headers.set(
            "Cache-Control",
            "private, no-store",
        );

        headers.set(
            "Content-Disposition",
            `attachment; filename="${safeDownloadFilename(
                attachment.original_filename,
            )}"`,
        );

        headers.set(
            "X-Content-Type-Options",
            "nosniff",
        );

        return new Response(
            object.body,
            {
                status: 200,
                headers,
            },
        );
    }
}
