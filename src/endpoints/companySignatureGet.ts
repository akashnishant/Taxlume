import { OpenAPIRoute } from "chanfana";
import { z } from "zod";
import type { AppContext } from "../types";

export class CompanySignatureGet extends OpenAPIRoute {
    schema = {
        tags: ["Company"],
        summary: "Get authorized signature image",
        responses: {
            "200": {
                description:
                    "Authorized signature retrieved successfully",
            },
            "404": {
                description:
                    "Authorized signature not found",
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

        const company =
            await c.env.DB
                .prepare(`
                    SELECT signature_key
                    FROM companies
                    WHERE
                        id = ?
                        AND is_active = 1
                    LIMIT 1
                `)
                .bind(companyId)
                .first<{
                    signature_key: string | null;
                }>();

        if (
            !company ||
            !company.signature_key
        ) {
            return c.json(
                {
                    success: false,
                    message:
                        "Authorized signature not found.",
                },
                404,
            );
        }

        const object =
            await c.env.billdesk_files.get(
                company.signature_key,
            );

        if (!object) {
            return c.json(
                {
                    success: false,
                    message:
                        "Authorized signature file not found.",
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