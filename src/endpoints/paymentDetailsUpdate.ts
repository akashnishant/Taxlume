import { OpenAPIRoute } from "chanfana";
import { z } from "zod";
import type { AppContext } from "../types";
import { prepareAuditLog } from "../utils/audit/auditLog";

const PaymentDetailsUpdateRequest = z.object({
    bank_name: z.string().max(200).nullable().optional(),
    account_holder_name: z.string().max(200).nullable().optional(),
    account_number: z.string().max(100).nullable().optional(),
    ifsc_code: z.string().max(20).nullable().optional(),
    branch_name: z.string().max(200).nullable().optional(),
    upi_id: z.string().max(200).nullable().optional(),
    show_qr_on_invoice: z.boolean().optional(),
});

export class PaymentDetailsUpdate extends OpenAPIRoute {
    schema = {
        tags: ["Company Payment Details"],
        summary: "Create or update company bank and payment details",
        request: {
            body: {
                content: {
                    "application/json": {
                        schema: PaymentDetailsUpdateRequest,
                    },
                },
            },
        },
        responses: {
            "200": {
                description:
                    "Payment details saved successfully",
                content: {
                    "application/json": {
                        schema: z.object({
                            success: z.boolean(),
                            message: z.string(),
                            payment_details: z.object({
                                id: z.string(),
                                company_id: z.string(),
                                bank_name: z.string().nullable(),
                                account_holder_name:
                                    z.string().nullable(),
                                account_number:
                                    z.string().nullable(),
                                ifsc_code: z.string().nullable(),
                                branch_name:
                                    z.string().nullable(),
                                upi_id: z.string().nullable(),
                                qr_code_key:
                                    z.string().nullable(),
                                show_qr_on_invoice:
                                    z.boolean(),
                            }),
                        }),
                    },
                },
            },
        },
    };

    async handle(c: AppContext) {
        const { body } =
            await this.getValidatedData<typeof this.schema>();

        const companyId = c.get("companyId");
        const userId = c.get("userId");
        const now = new Date().toISOString();

        const existing =
            await c.env.DB
                .prepare(`
                    SELECT
                        id,
                        bank_name,
                        account_holder_name,
                        account_number,
                        ifsc_code,
                        branch_name,
                        upi_id,
                        qr_code_key,
                        show_qr_on_invoice
                    FROM company_payment_details
                    WHERE company_id = ?
                    LIMIT 1
                `)
                .bind(companyId)
                .first<{
                    id: string;
                    bank_name: string | null;
                    account_holder_name: string | null;
                    account_number: string | null;
                    ifsc_code: string | null;
                    branch_name: string | null;
                    upi_id: string | null;
                    qr_code_key: string | null;
                    show_qr_on_invoice: number;
                }>();

        const id =
            existing?.id ??
            crypto.randomUUID();

        const bankName =
            body.bank_name !== undefined
                ? body.bank_name
                : existing?.bank_name ?? null;

        const accountHolderName =
            body.account_holder_name !== undefined
                ? body.account_holder_name
                : existing?.account_holder_name ?? null;

        const accountNumber =
            body.account_number !== undefined
                ? body.account_number
                : existing?.account_number ?? null;

        const ifscCode =
            body.ifsc_code !== undefined
                ? body.ifsc_code
                : existing?.ifsc_code ?? null;

        const branchName =
            body.branch_name !== undefined
                ? body.branch_name
                : existing?.branch_name ?? null;

        const upiId =
            body.upi_id !== undefined
                ? body.upi_id
                : existing?.upi_id ?? null;

        const showQrOnInvoice =
            body.show_qr_on_invoice !== undefined
                ? body.show_qr_on_invoice
                : existing
                    ? existing.show_qr_on_invoice === 1
                    : true;

        const saveStatement =
            c.env.DB
                .prepare(`
                    INSERT INTO company_payment_details (
                        id,
                        company_id,
                        bank_name,
                        account_holder_name,
                        account_number,
                        ifsc_code,
                        branch_name,
                        upi_id,
                        qr_code_key,
                        show_qr_on_invoice,
                        created_at,
                        updated_at
                    )
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    ON CONFLICT(company_id)
                    DO UPDATE SET
                        bank_name = excluded.bank_name,
                        account_holder_name =
                            excluded.account_holder_name,
                        account_number =
                            excluded.account_number,
                        ifsc_code =
                            excluded.ifsc_code,
                        branch_name =
                            excluded.branch_name,
                        upi_id =
                            excluded.upi_id,
                        show_qr_on_invoice =
                            excluded.show_qr_on_invoice,
                        updated_at =
                            excluded.updated_at
                `)
                .bind(
                    id,
                    companyId,
                    bankName,
                    accountHolderName,
                    accountNumber,
                    ifscCode,
                    branchName,
                    upiId,
                    existing?.qr_code_key ?? null,
                    showQrOnInvoice ? 1 : 0,
                    now,
                    now,
                );

        const auditStatement =
            prepareAuditLog(c.env.DB, {
                companyId,
                userId,
                entityType:
                    "COMPANY_PAYMENT_DETAILS",
                entityId: id,
                action:
                    existing
                        ? "PAYMENT_DETAILS_UPDATED"
                        : "PAYMENT_DETAILS_CREATED",
            });

        const results =
            await c.env.DB.batch([
                saveStatement,
                auditStatement,
            ]);

        const saveResult = results[0];
        const auditResult = results[1];

        if (
            !saveResult ||
            !auditResult ||
            !saveResult.success ||
            !auditResult.success
        ) {
            return c.json(
                {
                    success: false,
                    message:
                        "Payment details could not be saved",
                },
                400,
            );
        }

        return c.json({
            success: true,
            message:
                existing
                    ? "Payment details updated successfully"
                    : "Payment details created successfully",
            payment_details: {
                id,
                company_id: companyId,
                bank_name: bankName,
                account_holder_name:
                    accountHolderName,
                account_number:
                    accountNumber,
                ifsc_code: ifscCode,
                branch_name: branchName,
                upi_id: upiId,
                qr_code_key:
                    existing?.qr_code_key ?? null,
                show_qr_on_invoice:
                    showQrOnInvoice,
            },
        });
    }
}