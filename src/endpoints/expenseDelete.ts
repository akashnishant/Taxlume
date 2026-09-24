import { OpenAPIRoute } from "chanfana";
import { z } from "zod";
import { type AppContext } from "../types";
import { prepareAuditLog } from "../utils/audit/auditLog";

type ExpenseRow = {
    id: string;
    expense_date: string;
    category_id: string;
    vendor_id: string | null;
    amount_paise: number;
    currency_code: string;
    payment_method: string;
    source: string;
    recurring_rule_id: string | null;
    recurring_occurrence_date: string | null;
};

export class ExpenseDelete extends OpenAPIRoute {
    schema = {
        tags: ["Expenses"],
        summary: "Delete an expense",
        request: {
            params: z.object({
                id: z.string().uuid(),
            }),
        },
        responses: {
            "200": {
                description:
                    "Expense deleted successfully",
                content: {
                    "application/json": {
                        schema: z.object({
                            success: z.boolean(),
                            message: z.string(),
                            expense: z.object({
                                id: z.string(),
                                deleted_at: z.string(),
                                deleted_by: z.string(),
                            }),
                        }),
                    },
                },
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

        const userId =
            c.get("userId");

        const id =
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
            !id ||
            !z.string()
                .uuid()
                .safeParse(id)
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
                    SELECT
                        id,
                        expense_date,
                        category_id,
                        vendor_id,
                        amount_paise,
                        currency_code,
                        payment_method,
                        source,
                        recurring_rule_id,
                        recurring_occurrence_date

                    FROM expenses

                    WHERE id = ?
                      AND company_id = ?
                      AND deleted_at IS NULL

                    LIMIT 1
                `)
                .bind(
                    id,
                    companyId,
                )
                .first<ExpenseRow>();

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

        const now =
            new Date().toISOString();

        const deleteStatement =
            c.env.DB
                .prepare(`
                    UPDATE expenses

                    SET
                        deleted_by = ?,
                        deleted_at = ?,
                        updated_by = ?,
                        updated_at = ?

                    WHERE id = ?
                      AND company_id = ?
                      AND deleted_at IS NULL
                `)
                .bind(
                    userId,
                    now,
                    userId,
                    now,
                    id,
                    companyId,
                );

        const auditStatement =
            prepareAuditLog(
                c.env.DB,
                {
                    companyId,
                    userId,
                    entityType:
                        "EXPENSE",
                    entityId:
                        id,
                    action:
                        "DELETED",

                    metadata: {
                        expense_date:
                            expense.expense_date,

                        category_id:
                            expense.category_id,

                        vendor_id:
                            expense.vendor_id,

                        amount_paise:
                            expense.amount_paise,

                        currency_code:
                            expense.currency_code,

                        payment_method:
                            expense.payment_method,

                        source:
                            expense.source,

                        recurring_rule_id:
                            expense.recurring_rule_id,

                        recurring_occurrence_date:
                            expense.recurring_occurrence_date,
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
            results[0].meta.changes !== 1 ||
            !results[1]?.success
        ) {
            throw new Error(
                "Expense deletion did not complete",
            );
        }

        return c.json({
            success: true,
            message:
                "Expense deleted successfully",
            expense: {
                id,
                deleted_at:
                    now,
                deleted_by:
                    userId,
            },
        });
    }
}
