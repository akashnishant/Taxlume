import { OpenAPIRoute } from "chanfana";
import { z } from "zod";
import type { AppContext } from "../types";
import { prepareConditionalRecurringAudit } from "../utils/expenses/prepareConditionalRecurringAudit";
import { isExpenseCategorySelectable } from "../utils/expenses/isExpenseCategorySelectable";
import {
    getNextRecurringDateAfter,
    type RecurringFrequency,
} from "../utils/expenses/recurringSchedule";

const PaymentMethod =
    z.enum([
        "CASH",
        "UPI",
        "BANK_TRANSFER",
        "CHEQUE",
        "CARD",
        "OTHER",
    ]);

const Frequency =
    z.enum([
        "DAILY",
        "WEEKLY",
        "MONTHLY",
        "YEARLY",
    ]);

const CalendarDate =
    z.string()
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
                ] =
                    value.split("-");

                const year =
                    Number(
                        yearString,
                    );

                const month =
                    Number(
                        monthString,
                    );

                const day =
                    Number(
                        dayString,
                    );

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

const RecurringExpenseUpdateRequest =
    z.object({
        name:
            z.string()
                .trim()
                .min(1)
                .max(200)
                .optional(),

        category_id:
            z.string()
                .uuid()
                .optional(),

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
                )
                .optional(),

        payment_method:
            PaymentMethod.optional(),

        frequency:
            Frequency.optional(),

        interval_count:
            z.number()
                .int()
                .min(1)
                .optional(),

        start_date:
            CalendarDate.optional(),

        end_date:
            CalendarDate
                .nullable()
                .optional(),
    })
        .refine(
            (value) =>
                Object.keys(value)
                    .length > 0,
            {
                message:
                    "At least one field must be provided",
            },
        );

type ExistingRule = {
    id: string;
    name: string;

    category_id: string;

    vendor_id: string | null;
    payee_name: string | null;
    description: string | null;
    notes: string | null;

    amount_paise: number;
    currency_code: string;
    payment_method: string;

    frequency:
        RecurringFrequency;

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

function normalizeNullableText(
    value:
        | string
        | null
        | undefined,
): string | null {
    if (
        value === null ||
        value === undefined
    ) {
        return null;
    }

    const trimmed =
        value.trim();

    return trimmed || null;
}

export class RecurringExpenseUpdate
    extends OpenAPIRoute {

    schema = {
        tags: ["Recurring Expenses"],

        summary:
            "Update recurring expense rule",

        request: {
            params: z.object({
                id:
                    z.string().uuid(),
            }),

            body: {
                content: {
                    "application/json": {
                        schema:
                            RecurringExpenseUpdateRequest,
                    },
                },
            },
        },

        responses: {
            "200": {
                description:
                    "Recurring expense rule updated successfully",
            },

            "400": {
                description:
                    "Invalid recurring expense update",
            },

            "401": {
                description:
                    "Authentication required",
            },

            "404": {
                description:
                    "Recurring expense rule not found",
            },

            "409": {
                description:
                    "Update conflicts with generated recurring expenses",
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
                        "Invalid recurring expense rule ID",
                },
                400,
            );
        }

        const data =
            await this.getValidatedData<
                typeof this.schema
            >();

        const body =
            data.body;

        const existing =
            await c.env.DB
                .prepare(`
                    SELECT
                        id,
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
                        updated_by,

                        created_at,
                        updated_at

                    FROM recurring_expense_rules

                    WHERE id = ?
                      AND company_id = ?
                      AND deleted_at IS NULL

                    LIMIT 1
                `)
                .bind(
                    id,
                    companyId,
                )
                .first<ExistingRule>();

        if (!existing) {
            return c.json(
                {
                    success: false,
                    message:
                        "Recurring expense rule not found",
                },
                404,
            );
        }

        /*
         * Once generation has started, the original
         * start date is historical data and cannot
         * be rewritten.
         */
        if (
            existing.last_run_date &&
            body.start_date !==
                undefined &&
            body.start_date !==
                existing.start_date
        ) {
            return c.json(
                {
                    success: false,
                    message:
                        "Start date cannot be changed after recurring expenses have been generated",
                },
                409,
            );
        }

        const updatedName =
            body.name !== undefined
                ? body.name.trim()
                : existing.name;

        const updatedCategoryId =
            body.category_id ??
            existing.category_id;

        const updatedVendorId =
            body.vendor_id !==
            undefined
                ? body.vendor_id
                : existing.vendor_id;

        const updatedPayeeName =
            body.payee_name !==
            undefined
                ? normalizeNullableText(
                    body.payee_name,
                )
                : existing.payee_name;

        const updatedDescription =
            body.description !==
            undefined
                ? normalizeNullableText(
                    body.description,
                )
                : existing.description;

        const updatedNotes =
            body.notes !==
            undefined
                ? normalizeNullableText(
                    body.notes,
                )
                : existing.notes;

        const updatedAmountPaise =
            body.amount_paise ??
            existing.amount_paise;

        const updatedPaymentMethod =
            body.payment_method ??
            existing.payment_method;

        const updatedFrequency =
            (
                body.frequency ??
                existing.frequency
            ) as RecurringFrequency;

        const updatedIntervalCount =
            body.interval_count ??
            existing.interval_count;

        const updatedStartDate =
            body.start_date ??
            existing.start_date;

        const updatedEndDate =
            body.end_date !==
            undefined
                ? body.end_date
                : existing.end_date;

        if (
            updatedEndDate &&
            updatedEndDate <
                updatedStartDate
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

        if (
            existing.last_run_date &&
            updatedEndDate &&
            updatedEndDate <
                existing.last_run_date
        ) {
            return c.json(
                {
                    success: false,
                    message:
                        "End date cannot be before the last generated occurrence",
                },
                400,
            );
        }

        /*
         * Validate category only when the relationship
         * is actually changing. This allows unrelated
         * edits to historical rules whose category may
         * later have been disabled.
         */
        if (
            updatedCategoryId !==
            existing.category_id
        ) {
            const selectable =
                await isExpenseCategorySelectable(
                    c.env.DB,
                    companyId,
                    updatedCategoryId,
                );

            if (!selectable) {
                return c.json(
                    {
                        success: false,
                        message:
                            "Select an active expense category with an active parent",
                    },
                    400,
                );
            }
        }

        /*
         * Same principle for vendors: an existing
         * historical vendor does not block unrelated
         * edits, but a newly selected vendor must be
         * active, company-scoped, and have VENDOR role.
         */
        if (
            updatedVendorId !==
                existing.vendor_id &&
            updatedVendorId !==
                null
        ) {
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
                        updatedVendorId,
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

        const scheduleChanged =
            updatedStartDate !==
                existing.start_date ||
            updatedFrequency !==
                existing.frequency ||
            updatedIntervalCount !==
                existing.interval_count;

        let updatedNextRunDate =
            existing.next_run_date;

        /*
         * Before the first generated occurrence, the
         * whole schedule can be re-anchored freely.
         */
        if (
            !existing.last_run_date &&
            scheduleChanged
        ) {
            updatedNextRunDate =
                updatedStartDate;
        }

        /*
         * After generation begins, start_date is fixed.
         * Frequency/interval edits affect only future
         * occurrences and are calculated from the
         * existing recurrence anchor.
         */
        if (
            existing.last_run_date &&
            (
                updatedFrequency !==
                    existing.frequency ||
                updatedIntervalCount !==
                    existing.interval_count
            )
        ) {
            updatedNextRunDate =
                getNextRecurringDateAfter(
                    {
                        startDate:
                            existing.start_date,

                        afterDate:
                            existing.last_run_date,

                        frequency:
                            updatedFrequency,

                        intervalCount:
                            updatedIntervalCount,
                    },
                );
        }

        /*
         * We keep activation explicit. If no scheduled
         * occurrence exists before an intended end date,
         * the caller should deactivate the rule instead
         * of silently changing status here.
         */
        if (
            updatedEndDate &&
            updatedEndDate <
                updatedNextRunDate
        ) {
            return c.json(
                {
                    success: false,
                    message:
                        "End date cannot be before the next scheduled occurrence. Deactivate the rule if no further occurrences are required",
                },
                400,
            );
        }

        const currentValues:
            Record<
                string,
                string | number | null
            > = {
                name:
                    existing.name,

                category_id:
                    existing.category_id,

                vendor_id:
                    existing.vendor_id,

                payee_name:
                    existing.payee_name,

                description:
                    existing.description,

                notes:
                    existing.notes,

                amount_paise:
                    existing.amount_paise,

                payment_method:
                    existing.payment_method,

                frequency:
                    existing.frequency,

                interval_count:
                    existing.interval_count,

                start_date:
                    existing.start_date,

                end_date:
                    existing.end_date,

                next_run_date:
                    existing.next_run_date,
            };

        const updatedValues:
            Record<
                string,
                string | number | null
            > = {
                name:
                    updatedName,

                category_id:
                    updatedCategoryId,

                vendor_id:
                    updatedVendorId,

                payee_name:
                    updatedPayeeName,

                description:
                    updatedDescription,

                notes:
                    updatedNotes,

                amount_paise:
                    updatedAmountPaise,

                payment_method:
                    updatedPaymentMethod,

                frequency:
                    updatedFrequency,

                interval_count:
                    updatedIntervalCount,

                start_date:
                    updatedStartDate,

                end_date:
                    updatedEndDate,

                next_run_date:
                    updatedNextRunDate,
            };

        const changedFields =
            Object.keys(
                updatedValues,
            ).filter(
                (field) =>
                    currentValues[field] !==
                    updatedValues[field],
            );

        /*
         * No-op updates return successfully without
         * changing updated_at or creating an audit.
         */
        if (
            changedFields.length ===
            0
        ) {
            return c.json({
                success: true,

                message:
                    "Recurring expense rule is already up to date",

                recurring_expense: {
                    ...existing,
                },
            });
        }

        const before:
            Record<
                string,
                string | number | null
            > = {};

        const after:
            Record<
                string,
                string | number | null
            > = {};

        for (
            const field of
            changedFields
        ) {
            before[field] =
                currentValues[field] ??
                null;

            after[field] =
                updatedValues[field] ??
                null;
        }

        const now =
            new Date().toISOString();

        const updateStatement =
            c.env.DB
                .prepare(`
                    UPDATE recurring_expense_rules

                    SET
                        name = ?,
                        category_id = ?,
                        vendor_id = ?,
                        payee_name = ?,
                        description = ?,
                        notes = ?,
                        amount_paise = ?,
                        payment_method = ?,
                        frequency = ?,
                        interval_count = ?,
                        start_date = ?,
                        end_date = ?,
                        next_run_date = ?,
                        updated_by = ?,
                        updated_at = ?

                    WHERE id = ?
                      AND company_id = ?
                      AND deleted_at IS NULL
                      AND updated_at = ?
                      AND next_run_date = ?
                      AND last_run_date IS ?
                      AND is_active = ?
                `)
                .bind(
                    updatedName,
                    updatedCategoryId,
                    updatedVendorId,
                    updatedPayeeName,
                    updatedDescription,
                    updatedNotes,
                    updatedAmountPaise,
                    updatedPaymentMethod,
                    updatedFrequency,
                    updatedIntervalCount,
                    updatedStartDate,
                    updatedEndDate,
                    updatedNextRunDate,
                    userId,
                    now,
                    id,
                    companyId,
                    existing.updated_at,
                    existing.next_run_date,
                    existing.last_run_date,
                    existing.is_active,
                );

        const auditStatement =
            prepareConditionalRecurringAudit(
                c.env.DB,
                {
                    companyId,
                    userId,

                    entityType:
                        "RECURRING_EXPENSE_RULE",

                    entityId:
                        id,

                    action:
                        "UPDATED",

                    metadata: {
                        changed_fields:
                            changedFields,

                        before,

                        after,
                    },
                },
            );

        const results =
            await c.env.DB.batch([
                updateStatement,
                auditStatement,
            ]);

        if (
            !results[0]?.success ||
            !results[1]?.success
        ) {
            throw new Error(
                "Recurring expense rule update did not complete",
            );
        }

        if (results[0].meta.changes === 0) {
            if (results[1].meta.changes !== 0) {
                throw new Error(
                    "A stale recurring-rule mutation generated an audit",
                );
            }

            return c.json(
                {
                    success: false,
                    message:
                        "Recurring expense rule changed. Reload and try again.",
                },
                409,
            );
        }

        if (
            results[0].meta.changes !== 1 ||
            results[1].meta.changes !== 1
        ) {
            throw new Error(
                "Recurring expense rule update had unexpected write counts",
            );
        }

        return c.json({
            success: true,

            message:
                "Recurring expense rule updated successfully",

            recurring_expense: {
                id,

                name:
                    updatedName,

                category_id:
                    updatedCategoryId,

                vendor_id:
                    updatedVendorId,

                payee_name:
                    updatedPayeeName,

                description:
                    updatedDescription,

                notes:
                    updatedNotes,

                amount_paise:
                    updatedAmountPaise,

                currency_code:
                    existing.currency_code,

                payment_method:
                    updatedPaymentMethod,

                frequency:
                    updatedFrequency,

                interval_count:
                    updatedIntervalCount,

                start_date:
                    updatedStartDate,

                end_date:
                    updatedEndDate,

                next_run_date:
                    updatedNextRunDate,

                last_run_date:
                    existing.last_run_date,

                is_active:
                    existing.is_active,

                created_by:
                    existing.created_by,

                updated_by:
                    userId,

                created_at:
                    existing.created_at,

                updated_at:
                    now,
            },
        });
    }
}
