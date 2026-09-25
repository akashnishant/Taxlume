import { OpenAPIRoute } from "chanfana";
import { z } from "zod";
import type { AppContext } from "../types";
import { loadScheduledExpenseReport } from "../utils/expenses/loadScheduledExpenseReport";

const ExpenseReportQuery = z.object({
    start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    granularity: z.enum(["day", "month", "year"]),
});

type Granularity = z.infer<typeof ExpenseReportQuery>["granularity"];

type TotalRow = {
    currency_code: string;
    expense_count: number;
    total_paise: number;
    manual_paise: number;
    recurring_paise: number;
};

type PeriodRow = TotalRow & {
    period: string;
};

type CategoryRow = TotalRow & {
    category_id: string;
    category_name: string;
    parent_category_id: string | null;
    parent_category_name: string | null;
};

type CurrencyReport = TotalRow & {
    periods: PeriodRow[];
    categories: CategoryRow[];
};

function parseCalendarDate(value: string): Date | null {
    const date = new Date(`${value}T00:00:00.000Z`);

    if (
        Number.isNaN(date.getTime()) ||
        date.toISOString().slice(0, 10) !== value
    ) {
        return null;
    }

    return date;
}

function maxRangeDays(granularity: Granularity): number {
    // Keep daily response sizes bounded while supporting
    // longer comparisons in monthly and annual views.
    return granularity === "day" ? 731 : 3653;
}

export class ReportExpenses extends OpenAPIRoute {
    schema = {
        tags: ["Reports"],
        summary: "Get expense totals and category breakdowns",
        request: {
            query: ExpenseReportQuery,
        },
        responses: {
            "200": {
                description: "Expense report retrieved successfully",
            },
            "400": {
                description: "Invalid expense reporting date range",
            },
            "401": {
                description: "Authentication required",
            },
            "404": {
                description: "Company not found",
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
            start_date,
            end_date,
            granularity,
        } = validated.query;

        const startDate = parseCalendarDate(start_date);
        const endDate = parseCalendarDate(end_date);

        if (!startDate || !endDate || startDate > endDate) {
            return c.json(
                {
                    success: false,
                    message: "Enter a valid reporting date range",
                },
                400,
            );
        }

        const rangeDays =
            (endDate.getTime() - startDate.getTime()) /
            (24 * 60 * 60 * 1000);

        if (rangeDays > maxRangeDays(granularity)) {
            return c.json(
                {
                    success: false,
                    message:
                        granularity === "day"
                            ? "Daily reports support a maximum range of 731 days"
                            : "Monthly and annual reports support a maximum range of 3653 days",
                },
                400,
            );
        }

        const company = await c.env.DB
            .prepare(`
                SELECT currency_code
                FROM companies
                WHERE id = ?
                LIMIT 1
            `)
            .bind(companyId)
            .first<{ currency_code: string }>();

        if (!company) {
            return c.json(
                {
                    success: false,
                    message: "Company not found",
                },
                404,
            );
        }

        // The expression is selected from a fixed allowlist.
        // No request-provided text is interpolated into SQL.
        const periodLength =
            granularity === "day"
                ? 10
                : granularity === "month"
                  ? 7
                  : 4;

        const totalsQuery = c.env.DB
            .prepare(`
                SELECT
                    e.currency_code,
                    COUNT(*) AS expense_count,
                    COALESCE(SUM(e.amount_paise), 0)
                        AS total_paise,
                    COALESCE(SUM(
                        CASE WHEN e.source = 'MANUAL'
                            THEN e.amount_paise ELSE 0 END
                    ), 0) AS manual_paise,
                    COALESCE(SUM(
                        CASE WHEN e.source = 'RECURRING'
                            THEN e.amount_paise ELSE 0 END
                    ), 0) AS recurring_paise
                FROM expenses e
                WHERE e.company_id = ?
                  AND e.deleted_at IS NULL
                  AND e.expense_date >= ?
                  AND e.expense_date <= ?
                GROUP BY e.currency_code
                ORDER BY e.currency_code
            `)
            .bind(companyId, start_date, end_date)
            .all<TotalRow>();

        const periodsQuery = c.env.DB
            .prepare(`
                SELECT
                    substr(e.expense_date, 1, ${periodLength})
                        AS period,
                    e.currency_code,
                    COUNT(*) AS expense_count,
                    COALESCE(SUM(e.amount_paise), 0)
                        AS total_paise,
                    COALESCE(SUM(
                        CASE WHEN e.source = 'MANUAL'
                            THEN e.amount_paise ELSE 0 END
                    ), 0) AS manual_paise,
                    COALESCE(SUM(
                        CASE WHEN e.source = 'RECURRING'
                            THEN e.amount_paise ELSE 0 END
                    ), 0) AS recurring_paise
                FROM expenses e
                WHERE e.company_id = ?
                  AND e.deleted_at IS NULL
                  AND e.expense_date >= ?
                  AND e.expense_date <= ?
                GROUP BY period, e.currency_code
                ORDER BY period ASC, e.currency_code ASC
            `)
            .bind(companyId, start_date, end_date)
            .all<PeriodRow>();

        const categoriesQuery = c.env.DB
            .prepare(`
                SELECT
                    e.currency_code,
                    e.category_id,
                    category.name AS category_name,
                    category.parent_category_id,
                    parent.name AS parent_category_name,
                    COUNT(*) AS expense_count,
                    COALESCE(SUM(e.amount_paise), 0)
                        AS total_paise,
                    COALESCE(SUM(
                        CASE WHEN e.source = 'MANUAL'
                            THEN e.amount_paise ELSE 0 END
                    ), 0) AS manual_paise,
                    COALESCE(SUM(
                        CASE WHEN e.source = 'RECURRING'
                            THEN e.amount_paise ELSE 0 END
                    ), 0) AS recurring_paise
                FROM expenses e
                JOIN expense_categories category
                  ON category.id = e.category_id
                 AND category.company_id = e.company_id
                LEFT JOIN expense_categories parent
                  ON parent.id = category.parent_category_id
                 AND parent.company_id = e.company_id
                WHERE e.company_id = ?
                  AND e.deleted_at IS NULL
                  AND e.expense_date >= ?
                  AND e.expense_date <= ?
                GROUP BY e.currency_code, e.category_id
                ORDER BY total_paise DESC, category.name ASC
            `)
            .bind(companyId, start_date, end_date)
            .all<CategoryRow>();

        const [totalsResult, periodsResult, categoriesResult] =
            await Promise.all([
                totalsQuery,
                periodsQuery,
                categoriesQuery,
            ]);

        const currencies: CurrencyReport[] =
            totalsResult.results.map((total) => ({
                ...total,
                periods: periodsResult.results.filter(
                    (period) =>
                        period.currency_code === total.currency_code,
                ),
                categories: categoriesResult.results.filter(
                    (category) =>
                        category.currency_code === total.currency_code,
                ),
            }));

        // A new company should receive a meaningful zero-valued
        // report rather than an empty currencies array.
        if (currencies.length === 0) {
            currencies.push({
                currency_code: company.currency_code,
                expense_count: 0,
                total_paise: 0,
                manual_paise: 0,
                recurring_paise: 0,
                periods: [],
                categories: [],
            });
        }

        // Match the generator's UTC calendar-date convention.
        // This report does not run the generator or advance rules.
        const projectionAsOfDate =
            new Date().toISOString().slice(0, 10);

        const scheduledCurrencies =
            await loadScheduledExpenseReport({
                db: c.env.DB,
                companyId,
                reportStartDate: start_date,
                reportEndDate: end_date,
                asOfDate: projectionAsOfDate,
                periodLength,
            });

        return c.json({
            success: true,
            start_date,
            end_date,
            granularity,
            projection_as_of_date: projectionAsOfDate,
            currencies,
            scheduled_currencies: scheduledCurrencies,
        });
    }
}