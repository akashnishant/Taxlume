import { OpenAPIRoute } from "chanfana";
import { z } from "zod";
import type { AppContext } from "../types";

export class PaymentQrGet extends OpenAPIRoute {
    schema = {
        tags: ["Company Payment Details"],
        summary: "Get company payment QR code",
        responses: {
            "200": {
                description:
                    "Payment QR code retrieved successfully",
            },
            "404": {
                description:
                    "Payment QR code not found",
                content: {
                    "application/json": {
                        schema: z.object({
                            success: z.boolean(),
                            message: z.string(),
                        }),
                    },
                },
            },
        },
    };

    async handle(c: AppContext) {
        const companyId = c.get("companyId");

        const paymentDetails =
            await c.env.DB
                .prepare(`
                    SELECT qr_code_key
                    FROM company_payment_details
                    WHERE company_id = ?
                    LIMIT 1
                `)
                .bind(companyId)
                .first<{
                    qr_code_key: string | null;
                }>();

        if (
            !paymentDetails ||
            !paymentDetails.qr_code_key
        ) {
            return c.json(
                {
                    success: false,
                    message:
                        "Payment QR code not found.",
                },
                404,
            );
        }

        const object =
            await c.env.billdesk_files.get(
                paymentDetails.qr_code_key,
            );

        if (!object) {
            return c.json(
                {
                    success: false,
                    message:
                        "Payment QR code file not found.",
                },
                404,
            );
        }

        const headers = new Headers();

        headers.set(
            "Content-Type",
            object.httpMetadata?.contentType ??
                "application/octet-stream",
        );

        headers.set(
            "Content-Length",
            object.size.toString(),
        );

        headers.set(
            "Cache-Control",
            "private, no-store",
        );

        return new Response(
            object.body,
            {
                status: 200,
                headers,
            },
        );
    }
}