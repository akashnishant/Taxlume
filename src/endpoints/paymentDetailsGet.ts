import { OpenAPIRoute } from "chanfana";
import { z } from "zod";
import type { AppContext } from "../types";

export class PaymentDetailsGet extends OpenAPIRoute {
    schema = {
        tags: ["Company Payment Details"],
        summary: "Get company bank and payment details",
        responses: {
            "200": {
                description: "Payment details retrieved successfully",
                content: {
                    "application/json": {
                        schema: z.object({
                            success: z.boolean(),
                            payment_details: z.object({
                                id: z.string().nullable(),
                                company_id: z.string(),
                                bank_name: z.string().nullable(),
                                account_holder_name: z.string().nullable(),
                                account_number: z.string().nullable(),
                                ifsc_code: z.string().nullable(),
                                branch_name: z.string().nullable(),
                                upi_id: z.string().nullable(),
                                qr_code_key: z.string().nullable(),
                                show_qr_on_invoice: z.boolean(),
                            }),
                        }),
                    },
                },
            },
        },
    };

    async handle(c: AppContext) {
        const companyId = c.get("companyId");

        const paymentDetails = await c.env.DB
            .prepare(`
                SELECT
                    id,
                    company_id,
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
                company_id: string;
                bank_name: string | null;
                account_holder_name: string | null;
                account_number: string | null;
                ifsc_code: string | null;
                branch_name: string | null;
                upi_id: string | null;
                qr_code_key: string | null;
                show_qr_on_invoice: number;
            }>();

        return c.json({
            success: true,
            payment_details: {
                id: paymentDetails?.id ?? null,
                company_id: companyId,
                bank_name: paymentDetails?.bank_name ?? null,
                account_holder_name:
                    paymentDetails?.account_holder_name ?? null,
                account_number:
                    paymentDetails?.account_number ?? null,
                ifsc_code:
                    paymentDetails?.ifsc_code ?? null,
                branch_name:
                    paymentDetails?.branch_name ?? null,
                upi_id:
                    paymentDetails?.upi_id ?? null,
                qr_code_key:
                    paymentDetails?.qr_code_key ?? null,
                show_qr_on_invoice:
                    paymentDetails
                        ? paymentDetails.show_qr_on_invoice === 1
                        : true,
            },
        });
    }
}