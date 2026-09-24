import { OpenAPIRoute } from "chanfana";
import { z } from "zod";
import type { AppContext } from "../types";

type AttachmentRow = {
    id: string;
    expense_id: string;
    original_filename: string;
    content_type: string;
    size_bytes: number;
    created_by: string;
    created_at: string;
};

export class ExpenseAttachmentList
    extends OpenAPIRoute {

    schema = {
        tags: ["Expenses"],
        summary:
            "List receipt attachments for an expense",

        request: {
            params: z.object({
                id: z.string().uuid(),
            }),
        },

        responses: {
            "200": {
                description:
                    "Expense attachments retrieved successfully",
            },

            "400": {
                description:
                    "Invalid expense ID",
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

        const expenseId =
            c.req.param("id");

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

        const result =
            await c.env.DB
                .prepare(`
                    SELECT
                        id,
                        expense_id,
                        original_filename,
                        content_type,
                        size_bytes,
                        created_by,
                        created_at

                    FROM expense_attachments

                    WHERE company_id = ?
                      AND expense_id = ?
                      AND deleted_at IS NULL

                    ORDER BY
                        created_at DESC,
                        id DESC
                `)
                .bind(
                    companyId,
                    expenseId,
                )
                .all<AttachmentRow>();

        return c.json({
            success: true,
            attachments:
                result.results,
        });
    }
}
