import { OpenAPIRoute } from "chanfana";
import { z } from "zod";
import { type AppContext } from "../types";
import { prepareAuditLog } from "../utils/audit/auditLog";
import { isExpenseCategorySelectable } from "../utils/expenses/isExpenseCategorySelectable";

const ExpenseDate = z.string()
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

const PaymentMethod = z.enum([
    "CASH",
    "UPI",
    "BANK_TRANSFER",
    "CHEQUE",
    "CARD",
    "OTHER",
]);

const ExpenseUpdateRequest = z.object({
    expense_date: ExpenseDate.optional(),

    category_id: z
        .string()
        .uuid()
        .optional(),

    amount_paise: z
        .number()
        .int()
        .min(1)
        .max(Number.MAX_SAFE_INTEGER)
        .optional(),

    payment_method:
        PaymentMethod.optional(),

    vendor_id: z
        .string()
        .uuid()
        .nullable()
        .optional(),

    payee_name: z
        .string()
        .trim()
        .max(200)
        .nullable()
        .optional(),

    description: z
        .string()
        .trim()
        .max(1000)
        .nullable()
        .optional(),

    notes: z
        .string()
        .trim()
        .max(5000)
        .nullable()
        .optional(),

    reference_number: z
        .string()
        .trim()
        .max(200)
        .nullable()
        .optional(),
}).refine(
    (body) =>
        Object.values(body)
            .some((value) => value !== undefined),
    {
        message:
            "Provide at least one field to update",
    },
);

type ExpenseRow = {
    id: string;
    expense_date: string;

    category_id: string;

    vendor_id: string | null;
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

function optionalText(
    value: string | null | undefined,
): string | null {
    return value || null;
}

export class ExpenseUpdate extends OpenAPIRoute {
    schema = {
        tags: ["Expenses"],
        summary: "Update an expense",

        request: {
            params: z.object({
                id: z.string().uuid(),
            }),

            body: {
                content: {
                    "application/json": {
                        schema:
                            ExpenseUpdateRequest,
                    },
                },
            },
        },

        responses: {
            "200": {
                description:
                    "Expense updated successfully",
            },

            "400": {
                description:
                    "Invalid expense update",
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

        const validated =
            await this.getValidatedData<
                typeof this.schema
            >();

        const body =
            validated.body;

        const existing =
            await c.env.DB
                .prepare(`
                    SELECT
                        id,
                        expense_date,
                        category_id,
                        vendor_id,
                        payee_name,
                        description,
                        notes,
                        amount_paise,
                        currency_code,
                        payment_method,
                        reference_number,
                        source,
                        recurring_rule_id,
                        recurring_occurrence_date,
                        client_request_id,
                        created_by,
                        updated_by,
                        created_at,
                        updated_at

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

        if (!existing) {
            return c.json(
                {
                    success: false,
                    message:
                        "Expense not found",
                },
                404,
            );
        }

        const nextExpenseDate =
            body.expense_date ??
            existing.expense_date;

        const nextCategoryId =
            body.category_id ??
            existing.category_id;

        const nextVendorId =
            body.vendor_id !== undefined
                ? body.vendor_id
                : existing.vendor_id;

        const nextPayeeName =
            body.payee_name !== undefined
                ? optionalText(
                    body.payee_name,
                )
                : existing.payee_name;

        const nextDescription =
            body.description !== undefined
                ? optionalText(
                    body.description,
                )
                : existing.description;

        const nextNotes =
            body.notes !== undefined
                ? optionalText(
                    body.notes,
                )
                : existing.notes;

        const nextAmountPaise =
            body.amount_paise ??
            existing.amount_paise;

        const nextPaymentMethod =
            body.payment_method ??
            existing.payment_method;

        const nextReferenceNumber =
            body.reference_number !== undefined
                ? optionalText(
                    body.reference_number,
                )
                : existing.reference_number;

        /*
         * Historical expenses remain editable even when their
         * existing category has since been deactivated.
         *
         * Revalidate category eligibility only when the user
         * actually changes the category.
         */
        if (
            nextCategoryId !==
            existing.category_id
        ) {
            const selectable =
                await isExpenseCategorySelectable(
                    c.env.DB,
                    companyId,
                    nextCategoryId,
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
         * Apply the same historical-reference rule to vendors.
         * An unchanged inactive vendor does not prevent other
         * expense fields from being edited.
         */
        if (
            nextVendorId !==
            existing.vendor_id &&
            nextVendorId !== null
        ) {
            const vendor =
                await c.env.DB
                    .prepare(`
                        SELECT p.id

                        FROM parties AS p

                        WHERE p.id = ?
                          AND p.company_id = ?
                          AND p.is_active = 1

                          AND EXISTS (
                              SELECT 1
                              FROM party_roles AS pr
                              WHERE pr.party_id = p.id
                                AND pr.role = 'VENDOR'
                          )

                        LIMIT 1
                    `)
                    .bind(
                        nextVendorId,
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

        const changedFields: string[] = [];

        if (
            nextExpenseDate !==
            existing.expense_date
        ) {
            changedFields.push(
                "expense_date",
            );
        }

        if (
            nextCategoryId !==
            existing.category_id
        ) {
            changedFields.push(
                "category_id",
            );
        }

        if (
            nextVendorId !==
            existing.vendor_id
        ) {
            changedFields.push(
                "vendor_id",
            );
        }

        if (
            nextPayeeName !==
            existing.payee_name
        ) {
            changedFields.push(
                "payee_name",
            );
        }

        if (
            nextDescription !==
            existing.description
        ) {
            changedFields.push(
                "description",
            );
        }

        if (
            nextNotes !==
            existing.notes
        ) {
            changedFields.push(
                "notes",
            );
        }

        if (
            nextAmountPaise !==
            existing.amount_paise
        ) {
            changedFields.push(
                "amount_paise",
            );
        }

        if (
            nextPaymentMethod !==
            existing.payment_method
        ) {
            changedFields.push(
                "payment_method",
            );
        }

        if (
            nextReferenceNumber !==
            existing.reference_number
        ) {
            changedFields.push(
                "reference_number",
            );
        }

        /*
         * A no-op is successful but should not create another
         * audit record or change updated_at.
         */
        if (changedFields.length === 0) {
            return c.json({
                success: true,
                message:
                    "Expense already matches the requested values",
                expense: existing,
            });
        }

        const now =
            new Date().toISOString();

        const updateStatement =
            c.env.DB
                .prepare(`
                    UPDATE expenses

                    SET
                        expense_date = ?,
                        category_id = ?,
                        vendor_id = ?,
                        payee_name = ?,
                        description = ?,
                        notes = ?,
                        amount_paise = ?,
                        payment_method = ?,
                        reference_number = ?,
                        updated_by = ?,
                        updated_at = ?

                    WHERE id = ?
                      AND company_id = ?
                      AND deleted_at IS NULL
                `)
                .bind(
                    nextExpenseDate,
                    nextCategoryId,
                    nextVendorId,
                    nextPayeeName,
                    nextDescription,
                    nextNotes,
                    nextAmountPaise,
                    nextPaymentMethod,
                    nextReferenceNumber,
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
                        "UPDATED",

                    metadata: {
                        changed_fields:
                            changedFields,

                        previous_category_id:
                            existing.category_id,

                        new_category_id:
                            nextCategoryId,

                        previous_vendor_id:
                            existing.vendor_id,

                        new_vendor_id:
                            nextVendorId,

                        previous_amount_paise:
                            existing.amount_paise,

                        new_amount_paise:
                            nextAmountPaise,

                        previous_expense_date:
                            existing.expense_date,

                        new_expense_date:
                            nextExpenseDate,

                        previous_payment_method:
                            existing.payment_method,

                        new_payment_method:
                            nextPaymentMethod,
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
            results[0].meta.changes !== 1 ||
            !results[1]?.success
        ) {
            throw new Error(
                "Expense update did not complete",
            );
        }

        const updated =
            await c.env.DB
                .prepare(`
                    SELECT
                        id,
                        expense_date,
                        category_id,
                        vendor_id,
                        payee_name,
                        description,
                        notes,
                        amount_paise,
                        currency_code,
                        payment_method,
                        reference_number,
                        source,
                        recurring_rule_id,
                        recurring_occurrence_date,
                        client_request_id,
                        created_by,
                        updated_by,
                        created_at,
                        updated_at

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

        if (!updated) {
            throw new Error(
                "Updated expense could not be retrieved",
            );
        }

        return c.json({
            success: true,
            message:
                "Expense updated successfully",
            expense:
                updated,
        });
    }
}
