import { OpenAPIRoute } from "chanfana";
import { z } from "zod";
import type { AppContext } from "../types";
import { prepareAuditLog } from "../utils/audit/auditLog";
import { isExpenseCategorySelectable } from "../utils/expenses/isExpenseCategorySelectable";

const PaymentMethod = z.enum([
    "CASH",
    "UPI",
    "BANK_TRANSFER",
    "CHEQUE",
    "CARD",
    "OTHER",
]);

const Frequency = z.enum([
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

const RecurringExpenseCreateRequest =
    z.object({
        name:
            z.string()
                .trim()
                .min(1)
                .max(200),

        category_id:
            z.string().uuid(),

        vendor_id:
            z.string()
                .uuid()
                .nullable()
                .optional(),

        payee_name:
            z.string()
                .trim()
                .max(200)
                .nullable()
                .optional(),

        description:
            z.string()
                .trim()
                .max(1000)
                .nullable()
                .optional(),

        notes:
            z.string()
                .trim()
                .max(5000)
                .nullable()
                .optional(),

        amount_paise:
            z.number()
                .int()
                .min(1)
                .max(
                    Number.MAX_SAFE_INTEGER,
                ),

        payment_method:
            PaymentMethod,

        frequency:
            Frequency,

        interval_count:
            z.number()
                .int()
                .min(1)
                .default(1),

        start_date:
            CalendarDate,

        end_date:
            CalendarDate
                .nullable()
                .optional(),
    });

function normalizeNullableText(
    value:
        | string
        | null
        | undefined,
): string | null {
    if (
        value === undefined ||
        value === null
    ) {
        return null;
    }

    const trimmed =
        value.trim();

    return trimmed || null;
}

export class RecurringExpenseCreate
    extends OpenAPIRoute {

    schema = {
        tags: ["Recurring Expenses"],

        summary:
            "Create a recurring expense rule",

        request: {
            body: {
                content: {
                    "application/json": {
                        schema:
                            RecurringExpenseCreateRequest,
                    },
                },
            },
        },

        responses: {
            "201": {
                description:
                    "Recurring expense rule created successfully",
            },

            "400": {
                description:
                    "Invalid recurring expense rule",
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

        const userId =
            c.get("userId");

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

        const data =
            await this.getValidatedData<
                typeof this.schema
            >();

        const body =
            data.body;

        /*
         * Validate the date relationship explicitly
         * so the API returns a clear domain message
         * rather than relying only on the D1 CHECK.
         */
        if (
            body.end_date &&
            body.end_date <
                body.start_date
        ) {
            return c.json(
                {
                    success: false,
                    message:
                        "End date cannot be before start date",
                },
                400,
            );
        }

        const company =
            await c.env.DB
                .prepare(`
                    SELECT
                        id,
                        currency_code

                    FROM companies

                    WHERE id = ?
                      AND is_active = 1

                    LIMIT 1
                `)
                .bind(companyId)
                .first<{
                    id: string;
                    currency_code: string;
                }>();

        if (!company) {
            return c.json(
                {
                    success: false,
                    message:
                        "Company not found or inactive",
                },
                400,
            );
        }

        const categorySelectable =
            await isExpenseCategorySelectable(
                c.env.DB,
                companyId,
                body.category_id,
            );

        if (!categorySelectable) {
            return c.json(
                {
                    success: false,
                    message:
                        "Select an active expense category with an active parent",
                },
                400,
            );
        }

        const vendorId =
            body.vendor_id ??
            null;

        if (vendorId) {
            const vendor =
                await c.env.DB
                    .prepare(`
                        SELECT p.id

                        FROM parties AS p

                        INNER JOIN party_roles AS pr
                            ON pr.party_id = p.id

                        WHERE p.id = ?
                          AND p.company_id = ?
                          AND p.is_active = 1
                          AND pr.role = 'VENDOR'

                        LIMIT 1
                    `)
                    .bind(
                        vendorId,
                        companyId,
                    )
                    .first<{
                        id: string;
                    }>();

            if (!vendor) {
                return c.json(
                    {
                        success: false,
                        message:
                            "Vendor not found or inactive",
                    },
                    400,
                );
            }
        }

        const payeeName =
            normalizeNullableText(
                body.payee_name,
            );

        const description =
            normalizeNullableText(
                body.description,
            );

        const notes =
            normalizeNullableText(
                body.notes,
            );

        const endDate =
            body.end_date ??
            null;

        const ruleId =
            crypto.randomUUID();

        const now =
            new Date().toISOString();

        /*
         * A newly created rule is due first on its
         * start date. Scheduler state is not accepted
         * from the client.
         */
        const nextRunDate =
            body.start_date;

        const insertStatement =
            c.env.DB
                .prepare(`
                    INSERT INTO recurring_expense_rules (
                        id,
                        company_id,
                        name,
                        category_id,
                        vendor_id,
                        payee_name,
                        description,
                        notes,
                        amount_paise,
                        currency_code,
                        payment_method,
                        frequency,
                        interval_count,
                        start_date,
                        end_date,
                        next_run_date,
                        last_run_date,
                        is_active,
                        created_by,
                        created_at,
                        updated_at
                    )
                    VALUES (
                        ?,
                        ?,
                        ?,
                        ?,
                        ?,
                        ?,
                        ?,
                        ?,
                        ?,
                        ?,
                        ?,
                        ?,
                        ?,
                        ?,
                        ?,
                        ?,
                        NULL,
                        1,
                        ?,
                        ?,
                        ?
                    )
                `)
                .bind(
                    ruleId,
                    companyId,
                    body.name.trim(),
                    body.category_id,
                    vendorId,
                    payeeName,
                    description,
                    notes,
                    body.amount_paise,
                    company.currency_code,
                    body.payment_method,
                    body.frequency,
                    body.interval_count,
                    body.start_date,
                    endDate,
                    nextRunDate,
                    userId,
                    now,
                    now,
                );

        const auditStatement =
            prepareAuditLog(
                c.env.DB,
                {
                    companyId,
                    userId,

                    entityType:
                        "RECURRING_EXPENSE_RULE",

                    entityId:
                        ruleId,

                    action:
                        "CREATED",

                    metadata: {
                        category_id:
                            body.category_id,

                        vendor_id:
                            vendorId,

                        amount_paise:
                            body.amount_paise,

                        currency_code:
                            company.currency_code,

                        payment_method:
                            body.payment_method,

                        frequency:
                            body.frequency,

                        interval_count:
                            body.interval_count,

                        start_date:
                            body.start_date,

                        end_date:
                            endDate,

                        next_run_date:
                            nextRunDate,
                    },
                },
            );

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
            throw new Error(
                "Recurring expense rule creation did not complete",
            );
        }

        return c.json(
            {
                success: true,

                message:
                    "Recurring expense rule created successfully",

                recurring_expense: {
                    id:
                        ruleId,

                    name:
                        body.name.trim(),

                    category_id:
                        body.category_id,

                    vendor_id:
                        vendorId,

                    payee_name:
                        payeeName,

                    description,

                    notes,

                    amount_paise:
                        body.amount_paise,

                    currency_code:
                        company.currency_code,

                    payment_method:
                        body.payment_method,

                    frequency:
                        body.frequency,

                    interval_count:
                        body.interval_count,

                    start_date:
                        body.start_date,

                    end_date:
                        endDate,

                    next_run_date:
                        nextRunDate,

                    last_run_date:
                        null,

                    is_active:
                        1,

                    created_by:
                        userId,

                    created_at:
                        now,

                    updated_at:
                        now,
                },
            },
            201,
        );
    }
}
