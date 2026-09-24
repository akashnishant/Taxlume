import { OpenAPIRoute } from "chanfana";
import { z } from "zod";
import { type AppContext } from "../types";

type ExpenseDetailsRow = {
    id: string;
    expense_date: string;

    category_id: string;
    category_name: string | null;
    parent_category_id: string | null;
    parent_category_name: string | null;

    vendor_id: string | null;
    vendor_name: string | null;
    payee_name: string | null;

    description: string | null;
    notes: string | null;

    amount_paise: number;
    currency_code: string;
    payment_method: string;
    reference_number: string | null;

    source: string;
    recurring_rule_id: string | null;
    recurring_occurrence_date: string | null;
    client_request_id: string | null;

    created_by: string;
    updated_by: string | null;
    created_at: string;
    updated_at: string;
};

const ExpenseDetailsSchema = z.object({
    id: z.string(),
    expense_date: z.string(),

    category_id: z.string(),
    category_name: z.string().nullable(),
    parent_category_id: z.string().nullable(),
    parent_category_name: z.string().nullable(),

    vendor_id: z.string().nullable(),
    vendor_name: z.string().nullable(),
    payee_name: z.string().nullable(),

    description: z.string().nullable(),
    notes: z.string().nullable(),

    amount_paise: z.number(),
    currency_code: z.string(),
    payment_method: z.string(),
    reference_number: z.string().nullable(),

    source: z.string(),
    recurring_rule_id: z.string().nullable(),
    recurring_occurrence_date: z.string().nullable(),
    client_request_id: z.string().nullable(),

    created_by: z.string(),
    updated_by: z.string().nullable(),
    created_at: z.string(),
    updated_at: z.string(),
});

export class ExpenseGet extends OpenAPIRoute {
    schema = {
        tags: ["Expenses"],
        summary: "Get an expense",
        request: {
            params: z.object({
                id: z.string().uuid(),
            }),
        },
        responses: {
            "200": {
                description: "Expense retrieved successfully",
                content: {
                    "application/json": {
                        schema: z.object({
                            success: z.boolean(),
                            expense: ExpenseDetailsSchema,
                        }),
                    },
                },
            },
            "400": {
                description: "Invalid expense ID",
            },
            "401": {
                description: "Authentication required",
            },
            "404": {
                description: "Expense not found",
            },
        },
    };

    async handle(c: AppContext) {
        const companyId = c.get("companyId");
        const id = c.req.param("id");

        if (!companyId) {
            return c.json(
                {
                    success: false,
                    message: "Authentication context is missing",
                },
                401,
            );
        }

        if (!id || !z.string().uuid().safeParse(id).success) {
            return c.json(
                {
                    success: false,
                    message: "Invalid expense ID",
                },
                400,
            );
        }

        const expense = await c.env.DB
            .prepare(`
                SELECT
                    e.id,
                    e.expense_date,

                    e.category_id,
                    category.name AS category_name,
                    category.parent_category_id,
                    parent_category.name AS parent_category_name,

                    e.vendor_id,
                    vendor.display_name AS vendor_name,
                    e.payee_name,

                    e.description,
                    e.notes,

                    e.amount_paise,
                    e.currency_code,
                    e.payment_method,
                    e.reference_number,

                    e.source,
                    e.recurring_rule_id,
                    e.recurring_occurrence_date,
                    e.client_request_id,

                    e.created_by,
                    e.updated_by,
                    e.created_at,
                    e.updated_at

                FROM expenses AS e

                LEFT JOIN expense_categories AS category
                    ON category.id = e.category_id
                   AND category.company_id = e.company_id

                LEFT JOIN expense_categories AS parent_category
                    ON parent_category.id = category.parent_category_id
                   AND parent_category.company_id = e.company_id

                LEFT JOIN parties AS vendor
                    ON vendor.id = e.vendor_id
                   AND vendor.company_id = e.company_id

                WHERE e.id = ?
                  AND e.company_id = ?
                  AND e.deleted_at IS NULL

                LIMIT 1
            `)
            .bind(id, companyId)
            .first<ExpenseDetailsRow>();

        if (!expense) {
            return c.json(
                {
                    success: false,
                    message: "Expense not found",
                },
                404,
            );
        }

        return c.json({
            success: true,
            expense,
        });
    }
}
