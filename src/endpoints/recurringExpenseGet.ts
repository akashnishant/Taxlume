import { OpenAPIRoute } from "chanfana";
import { z } from "zod";
import type { AppContext } from "../types";

type RecurringExpenseRow = {
    id: string;
    name: string;

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

    frequency: string;
    interval_count: number;

    start_date: string;
    end_date: string | null;

    next_run_date: string;
    last_run_date: string | null;

    is_active: number;

    created_by: string;
    updated_by: string | null;

    created_at: string;
    updated_at: string;
};

export class RecurringExpenseGet
    extends OpenAPIRoute {

    schema = {
        tags: ["Recurring Expenses"],

        summary:
            "Get recurring expense rule",

        request: {
            params: z.object({
                id: z.string().uuid(),
            }),
        },

        responses: {
            "200": {
                description:
                    "Recurring expense rule retrieved successfully",
            },

            "400": {
                description:
                    "Invalid recurring expense rule ID",
            },

            "401": {
                description:
                    "Authentication required",
            },

            "404": {
                description:
                    "Recurring expense rule not found",
            },
        },
    };

    async handle(c: AppContext) {
        const companyId =
            c.get("companyId");

        const id =
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
                        "Invalid recurring expense rule ID",
                },
                400,
            );
        }

        const rule =
            await c.env.DB
                .prepare(`
                    SELECT
                        r.id,
                        r.name,

                        r.category_id,
                        category.name
                            AS category_name,

                        category.parent_category_id,
                        parent_category.name
                            AS parent_category_name,

                        r.vendor_id,
                        vendor.display_name
                            AS vendor_name,

                        r.payee_name,
                        r.description,
                        r.notes,

                        r.amount_paise,
                        r.currency_code,
                        r.payment_method,

                        r.frequency,
                        r.interval_count,

                        r.start_date,
                        r.end_date,

                        r.next_run_date,
                        r.last_run_date,

                        r.is_active,

                        r.created_by,
                        r.updated_by,

                        r.created_at,
                        r.updated_at

                    FROM recurring_expense_rules AS r

                    LEFT JOIN expense_categories
                        AS category
                        ON category.id =
                            r.category_id
                       AND category.company_id =
                            r.company_id

                    LEFT JOIN expense_categories
                        AS parent_category
                        ON parent_category.id =
                            category.parent_category_id
                       AND parent_category.company_id =
                            r.company_id

                    LEFT JOIN parties
                        AS vendor
                        ON vendor.id =
                            r.vendor_id
                       AND vendor.company_id =
                            r.company_id

                    WHERE r.id = ?
                      AND r.company_id = ?
                      AND r.deleted_at IS NULL

                    LIMIT 1
                `)
                .bind(
                    id,
                    companyId,
                )
                .first<RecurringExpenseRow>();

        if (!rule) {
            return c.json(
                {
                    success: false,
                    message:
                        "Recurring expense rule not found",
                },
                404,
            );
        }

        return c.json({
            success: true,
            recurring_expense:
                rule,
        });
    }
}
