import { OpenAPIRoute } from "chanfana";
import { z } from "zod";
import { type AppContext } from "../types";

const CalendarDate = z.string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD")
    .refine((value) => {
        const timestamp =
            Date.parse(`${value}T00:00:00.000Z`);

        return (
            Number.isFinite(timestamp) &&
            new Date(timestamp)
                .toISOString()
                .slice(0, 10) === value
        );
    }, "Enter a valid calendar date");

const ExpenseListQuery = z.object({
    page: z.coerce
        .number()
        .int()
        .min(1)
        .default(1),

    limit: z.coerce
        .number()
        .int()
        .min(1)
        .max(100)
        .default(20),

    start_date: CalendarDate.optional(),
    end_date: CalendarDate.optional(),

    category_id: z.string().uuid().optional(),
    vendor_id: z.string().uuid().optional(),

    payment_method: z.enum([
        "CASH",
        "UPI",
        "BANK_TRANSFER",
        "CHEQUE",
        "CARD",
        "OTHER",
    ]).optional(),

    source: z.enum([
        "MANUAL",
        "RECURRING",
    ]).optional(),

    search: z.string()
        .trim()
        .max(100)
        .optional(),
});

type ExpenseListRow = {
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

    amount_paise: number;
    currency_code: string;
    payment_method: string;
    reference_number: string | null;

    source: string;

    created_at: string;
    updated_at: string;
};

export class ExpenseList extends OpenAPIRoute {
    schema = {
        tags: ["Expenses"],
        summary: "List expenses",
        request: {
            query: ExpenseListQuery,
        },
        responses: {
            "200": {
                description: "Expenses retrieved successfully",
            },
            "400": {
                description: "Invalid expense filters",
            },
            "401": {
                description: "Authentication required",
            },
        },
    };

    async handle(c: AppContext) {
        const companyId = c.get("companyId");

        if (!companyId) {
            return c.json(
                {
                    success: false,
                    message: "Authentication context is missing",
                },
                401,
            );
        }

        const validated =
            await this.getValidatedData<typeof this.schema>();

        const {
            page,
            limit,
            start_date,
            end_date,
            category_id,
            vendor_id,
            payment_method,
            source,
            search,
        } = validated.query;

        if (
            start_date &&
            end_date &&
            start_date > end_date
        ) {
            return c.json(
                {
                    success: false,
                    message:
                        "Start date cannot be after end date",
                },
                400,
            );
        }

        const offset =
            (page - 1) * limit;

        const conditions: string[] = [
            "e.company_id = ?",
            "e.deleted_at IS NULL",
        ];

        const bindings: (string | number)[] = [
            companyId,
        ];

        if (start_date) {
            conditions.push(
                "e.expense_date >= ?",
            );
            bindings.push(start_date);
        }

        if (end_date) {
            conditions.push(
                "e.expense_date <= ?",
            );
            bindings.push(end_date);
        }

        if (category_id) {
            conditions.push(
                "e.category_id = ?",
            );
            bindings.push(category_id);
        }

        if (vendor_id) {
            conditions.push(
                "e.vendor_id = ?",
            );
            bindings.push(vendor_id);
        }

        if (payment_method) {
            conditions.push(
                "e.payment_method = ?",
            );
            bindings.push(payment_method);
        }

        if (source) {
            conditions.push(
                "e.source = ?",
            );
            bindings.push(source);
        }

        if (search) {
            const searchValue =
                `%${search}%`;

            conditions.push(`
                (
                    COALESCE(e.payee_name, '') LIKE ?
                    OR COALESCE(e.description, '') LIKE ?
                    OR COALESCE(e.notes, '') LIKE ?
                    OR COALESCE(e.reference_number, '') LIKE ?
                    OR COALESCE(vendor.display_name, '') LIKE ?
                    OR COALESCE(category.name, '') LIKE ?
                )
            `);

            bindings.push(
                searchValue,
                searchValue,
                searchValue,
                searchValue,
                searchValue,
                searchValue,
            );
        }

        const whereClause =
            conditions.join(" AND ");

        const countResult =
            await c.env.DB
                .prepare(`
                    SELECT
                        COUNT(*) AS total

                    FROM expenses AS e

                    LEFT JOIN expense_categories AS category
                        ON category.id = e.category_id
                       AND category.company_id = e.company_id

                    LEFT JOIN parties AS vendor
                        ON vendor.id = e.vendor_id
                       AND vendor.company_id = e.company_id

                    WHERE ${whereClause}
                `)
                .bind(...bindings)
                .first<{ total: number }>();

        const total =
            countResult?.total ?? 0;

        const result =
            await c.env.DB
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

                        e.amount_paise,
                        e.currency_code,
                        e.payment_method,
                        e.reference_number,

                        e.source,

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

                    WHERE ${whereClause}

                    ORDER BY
                        e.expense_date DESC,
                        e.created_at DESC,
                        e.id DESC

                    LIMIT ? OFFSET ?
                `)
                .bind(
                    ...bindings,
                    limit,
                    offset,
                )
                .all<ExpenseListRow>();

        const totalPages =
            total === 0
                ? 0
                : Math.ceil(total / limit);

        return c.json({
            success: true,
            expenses: result.results,
            pagination: {
                page,
                limit,
                total,
                total_pages: totalPages,
            },
        });
    }
}
