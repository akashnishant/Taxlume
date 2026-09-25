import { OpenAPIRoute } from "chanfana";
import { z } from "zod";
import type { AppContext } from "../types";

const Frequency =
    z.enum([
        "DAILY",
        "WEEKLY",
        "MONTHLY",
        "YEARLY",
    ]);

const CalendarDate = z
    .string()
    .regex(
        /^\d{4}-\d{2}-\d{2}$/,
        "Date must use YYYY-MM-DD format",
    )
    .refine(
        (value) => {
            const [
                yearString,
                monthString,
                dayString,
            ] = value.split("-");

            const year =
                Number(yearString);

            const month =
                Number(monthString);

            const day =
                Number(dayString);

            const date =
                new Date(
                    Date.UTC(
                        year,
                        month - 1,
                        day,
                    ),
                );

            return (
                date.getUTCFullYear() ===
                    year &&
                date.getUTCMonth() ===
                    month - 1 &&
                date.getUTCDate() ===
                    day
            );
        },
        "Date is not a valid calendar date",
    );

const RecurringExpenseListQuery =
    z.object({
        page:
            z.coerce
                .number()
                .int()
                .min(1)
                .default(1),

        limit:
            z.coerce
                .number()
                .int()
                .min(1)
                .max(100)
                .default(20),

        status:
            z.enum([
                "ACTIVE",
                "INACTIVE",
            ])
                .optional(),

        frequency:
            Frequency.optional(),

        category_id:
            z.string()
                .uuid()
                .optional(),

        vendor_id:
            z.string()
                .uuid()
                .optional(),

        due_on_or_before:
            CalendarDate.optional(),

        search:
            z.string()
                .trim()
                .max(100)
                .optional(),
    });

type RecurringExpenseListRow = {
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

    created_at: string;
    updated_at: string;
};

export class RecurringExpenseList
    extends OpenAPIRoute {

    schema = {
        tags: ["Recurring Expenses"],

        summary:
            "List recurring expense rules",

        request: {
            query:
                RecurringExpenseListQuery,
        },

        responses: {
            "200": {
                description:
                    "Recurring expense rules retrieved successfully",
            },

            "401": {
                description:
                    "Authentication required",
            },
        },
    };

    async handle(c: AppContext) {
        const companyId =
            c.get("companyId");

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

        const data =
            await this.getValidatedData<
                typeof this.schema
            >();

        const {
            page,
            limit,
            status,
            frequency,
            category_id,
            vendor_id,
            due_on_or_before,
            search,
        } =
            data.query;

        const offset =
            (page - 1) *
            limit;

        const conditions: string[] = [
            "r.company_id = ?",
            "r.deleted_at IS NULL",
        ];

        const bindings:
            (string | number)[] = [
                companyId,
            ];

        if (status) {
            conditions.push(
                "r.is_active = ?",
            );

            bindings.push(
                status === "ACTIVE"
                    ? 1
                    : 0,
            );
        }

        if (frequency) {
            conditions.push(
                "r.frequency = ?",
            );

            bindings.push(
                frequency,
            );
        }

        if (category_id) {
            conditions.push(
                "r.category_id = ?",
            );

            bindings.push(
                category_id,
            );
        }

        if (vendor_id) {
            conditions.push(
                "r.vendor_id = ?",
            );

            bindings.push(
                vendor_id,
            );
        }

        if (due_on_or_before) {
            conditions.push(
                "r.next_run_date <= ?",
            );

            bindings.push(
                due_on_or_before,
            );
        }

        if (search) {
            const searchValue =
                `%${search}%`;

            conditions.push(`
                (
                    r.name LIKE ?
                    OR r.payee_name LIKE ?
                    OR r.description LIKE ?
                    OR r.notes LIKE ?
                    OR category.name LIKE ?
                    OR parent_category.name LIKE ?
                    OR vendor.display_name LIKE ?
                )
            `);

            bindings.push(
                searchValue,
                searchValue,
                searchValue,
                searchValue,
                searchValue,
                searchValue,
                searchValue,
            );
        }

        const whereClause =
            conditions.join(
                " AND ",
            );

        const joins = `
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
        `;

        const countResult =
            await c.env.DB
                .prepare(`
                    SELECT
                        COUNT(*) AS total

                    FROM recurring_expense_rules
                        AS r

                    ${joins}

                    WHERE ${whereClause}
                `)
                .bind(
                    ...bindings,
                )
                .first<{
                    total: number;
                }>();

        const total =
            countResult?.total ??
            0;

        const result =
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

                        r.created_at,
                        r.updated_at

                    FROM recurring_expense_rules
                        AS r

                    ${joins}

                    WHERE ${whereClause}

                    ORDER BY
                        r.is_active DESC,
                        r.next_run_date ASC,
                        r.created_at DESC,
                        r.id DESC

                    LIMIT ?
                    OFFSET ?
                `)
                .bind(
                    ...bindings,
                    limit,
                    offset,
                )
                .all<
                    RecurringExpenseListRow
                >();

        const totalPages =
            total === 0
                ? 0
                : Math.ceil(
                    total /
                    limit,
                );

        return c.json({
            success: true,

            recurring_expenses:
                result.results,

            pagination: {
                page,
                limit,
                total,
                total_pages:
                    totalPages,
            },
        });
    }
}
