import { OpenAPIRoute } from "chanfana";
import { z } from "zod";
import { type AppContext } from "../types";
import { prepareAuditLog } from "../utils/audit/auditLog";
import { isExpenseCategorySelectable } from "../utils/expenses/isExpenseCategorySelectable";

const ExpenseDate = z.string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD")
    .refine((value) => {
        const timestamp = Date.parse(`${value}T00:00:00.000Z`);

        return Number.isFinite(timestamp) &&
            new Date(timestamp).toISOString().slice(0, 10) === value;
    }, "Enter a valid calendar date");

const PaymentMethod = z.enum([
    "CASH",
    "UPI",
    "BANK_TRANSFER",
    "CHEQUE",
    "CARD",
    "OTHER",
]);

const ExpenseCreateRequest = z.object({
    expense_date: ExpenseDate,
    category_id: z.string().uuid(),
    amount_paise: z.number().int().min(1).max(Number.MAX_SAFE_INTEGER),
    payment_method: PaymentMethod,

    vendor_id: z.string().uuid().nullable().optional(),
    payee_name: z.string().trim().max(200).nullable().optional(),
    description: z.string().trim().max(1000).nullable().optional(),
    notes: z.string().trim().max(5000).nullable().optional(),
    reference_number: z.string().trim().max(200).nullable().optional(),

    // Generate once when the user submits, then reuse on a retry.
    client_request_id: z.string().uuid(),
});

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
    client_request_id: string | null;
    created_at: string;
    updated_at: string;
};

type ExpenseInput = z.infer<typeof ExpenseCreateRequest>;

function optionalText(value: string | null | undefined): string | null {
    return value || null;
}

function matchesExistingRequest(
    existing: ExpenseRow,
    input: ExpenseInput,
    currencyCode: string,
): boolean {
    return (
        existing.expense_date === input.expense_date &&
        existing.category_id === input.category_id &&
        existing.vendor_id === (input.vendor_id ?? null) &&
        existing.payee_name === optionalText(input.payee_name) &&
        existing.description === optionalText(input.description) &&
        existing.notes === optionalText(input.notes) &&
        existing.amount_paise === input.amount_paise &&
        existing.currency_code === currencyCode &&
        existing.payment_method === input.payment_method &&
        existing.reference_number === optionalText(input.reference_number) &&
        existing.source === "MANUAL"
    );
}

async function findExistingExpense(
    db: D1Database,
    companyId: string,
    clientRequestId: string,
): Promise<ExpenseRow | null> {
    return db
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
                client_request_id,
                created_at,
                updated_at
            FROM expenses
            WHERE company_id = ?
              AND client_request_id = ?
              AND deleted_at IS NULL
            LIMIT 1
        `)
        .bind(companyId, clientRequestId)
        .first<ExpenseRow>();
}

const ExpenseResponse = z.object({
    success: z.boolean(),
    expense: z.object({
        id: z.string(),
        expense_date: z.string(),
        category_id: z.string(),
        vendor_id: z.string().nullable(),
        payee_name: z.string().nullable(),
        description: z.string().nullable(),
        notes: z.string().nullable(),
        amount_paise: z.number(),
        currency_code: z.string(),
        payment_method: z.string(),
        reference_number: z.string().nullable(),
        source: z.string(),
        client_request_id: z.string().nullable(),
        created_at: z.string(),
        updated_at: z.string(),
    }),
});

export class ExpenseCreate extends OpenAPIRoute {
    schema = {
        tags: ["Expenses"],
        summary: "Record a manual business expense",
        request: {
            body: {
                content: {
                    "application/json": {
                        schema: ExpenseCreateRequest,
                    },
                },
            },
        },
        responses: {
            "200": {
                description: "Previously recorded expense returned for an identical retry",
                content: {
                    "application/json": {
                        schema: ExpenseResponse,
                    },
                },
            },
            "201": {
                description: "Expense recorded successfully",
                content: {
                    "application/json": {
                        schema: ExpenseResponse,
                    },
                },
            },
            "400": {
                description: "Invalid expense category or vendor",
            },
            "401": {
                description: "Authentication required",
            },
            "409": {
                description: "Client request ID was reused with different expense details",
            },
        },
    };

    async handle(c: AppContext) {
        const companyId = c.get("companyId");
        const userId = c.get("userId");

        if (!companyId || !userId) {
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

        const body = validated.body;

        const company = await c.env.DB
            .prepare(`
                SELECT currency_code
                FROM companies
                WHERE id = ?
                  AND is_active = 1
                LIMIT 1
            `)
            .bind(companyId)
            .first<{ currency_code: string }>();

        if (!company) {
            return c.json(
                {
                    success: false,
                    message: "Company not found or inactive",
                },
                401,
            );
        }

        // Check retries before checking current category/vendor status.
        // A successful expense must remain retrievable on retry even
        // if its category or vendor was deactivated afterward.
        const existing = await findExistingExpense(
            c.env.DB,
            companyId,
            body.client_request_id,
        );

        if (existing) {
            if (!matchesExistingRequest(existing, body, company.currency_code)) {
                return c.json(
                    {
                        success: false,
                        message:
                            "Client request ID has already been used for a different expense",
                    },
                    409,
                );
            }

            return c.json(
                {
                    success: true,
                    expense: existing,
                },
                200,
            );
        }

        const categoryIsSelectable = await isExpenseCategorySelectable(
            c.env.DB,
            companyId,
            body.category_id,
        );

        if (!categoryIsSelectable) {
            return c.json(
                {
                    success: false,
                    message:
                        "Select an active expense category with an active parent",
                },
                400,
            );
        }

        const vendorId = body.vendor_id ?? null;

        if (vendorId) {
            const vendor = await c.env.DB
                .prepare(`
                    SELECT p.id
                    FROM parties AS p
                    INNER JOIN party_roles AS pr
                        ON pr.party_id = p.id
                       AND pr.role = 'VENDOR'
                    WHERE p.id = ?
                      AND p.company_id = ?
                      AND p.is_active = 1
                    LIMIT 1
                `)
                .bind(vendorId, companyId)
                .first<{ id: string }>();

            if (!vendor) {
                return c.json(
                    {
                        success: false,
                        message: "Vendor not found or inactive",
                    },
                    400,
                );
            }
        }

        const expenseId = crypto.randomUUID();
        const now = new Date().toISOString();

        const insertStatement = c.env.DB
            .prepare(`
                INSERT INTO expenses (
                    id,
                    company_id,
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
                    client_request_id,
                    created_by,
                    created_at,
                    updated_at
                )
                VALUES (
                    ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'MANUAL', ?, ?, ?, ?
                )
            `)
            .bind(
                expenseId,
                companyId,
                body.expense_date,
                body.category_id,
                vendorId,
                optionalText(body.payee_name),
                optionalText(body.description),
                optionalText(body.notes),
                body.amount_paise,
                company.currency_code,
                body.payment_method,
                optionalText(body.reference_number),
                body.client_request_id,
                userId,
                now,
                now,
            );

        const auditStatement = prepareAuditLog(c.env.DB, {
            companyId,
            userId,
            entityType: "EXPENSE",
            entityId: expenseId,
            action: "CREATED",
            metadata: {
                category_id: body.category_id,
                amount_paise: body.amount_paise,
                currency_code: company.currency_code,
                source: "MANUAL",
            },
        });

        try {
            const results = await c.env.DB.batch([
                insertStatement,
                auditStatement,
            ]);

            if (
                !results[0]?.success ||
                results[0].meta.changes !== 1 ||
                !results[1]?.success
            ) {
                throw new Error("Expense creation did not complete");
            }
        } catch (error) {
            const message = String(error);

            const duplicateClientRequest =
                /ux_expenses_client_request/i.test(message) ||
                /expenses\.company_id,\s*expenses\.client_request_id/i.test(message);

            if (!duplicateClientRequest) {
                throw error;
            }

            // A simultaneous retry may have inserted the same ID
            // after our first lookup. Return its result only if the
            // submitted expense details are identical.
            const saved = await findExistingExpense(
                c.env.DB,
                companyId,
                body.client_request_id,
            );

            if (
                saved &&
                matchesExistingRequest(saved, body, company.currency_code)
            ) {
                return c.json(
                    {
                        success: true,
                        expense: saved,
                    },
                    200,
                );
            }

            return c.json(
                {
                    success: false,
                    message:
                        "Client request ID has already been used for a different expense",
                },
                409,
            );
        }

        return c.json(
            {
                success: true,
                expense: {
                    id: expenseId,
                    expense_date: body.expense_date,
                    category_id: body.category_id,
                    vendor_id: vendorId,
                    payee_name: optionalText(body.payee_name),
                    description: optionalText(body.description),
                    notes: optionalText(body.notes),
                    amount_paise: body.amount_paise,
                    currency_code: company.currency_code,
                    payment_method: body.payment_method,
                    reference_number: optionalText(body.reference_number),
                    source: "MANUAL",
                    client_request_id: body.client_request_id,
                    created_at: now,
                    updated_at: now,
                },
            },
            201,
        );
    }
}
