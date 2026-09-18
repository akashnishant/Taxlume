import { OpenAPIRoute } from "chanfana";
import { z } from "zod";
import type { AppContext } from "../types";

const DocumentSnapshotAssetParams = z.object({
    id: z.string().uuid(),
    asset: z.enum(["signature", "payment-qr"]),
});

type SnapshotRow = {
    signature_key: string | null;
    payment_qr_key: string | null;
};

export class DocumentSnapshotAssetGet extends OpenAPIRoute {
    schema = {
        tags: ["Documents"],
        summary: "Get an immutable issued-document asset",
        request: {
            params: DocumentSnapshotAssetParams,
        },
        responses: {
            "200": {
                description:
                    "Document snapshot asset retrieved successfully",
            },
            "401": {
                description: "Authentication required",
            },
            "404": {
                description:
                    "Document snapshot asset not found",
            },
        },
    };

    async handle(c: AppContext) {
        const companyId = c.get("companyId");

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

        const { params } =
            await this.getValidatedData<typeof this.schema>();

        const snapshot =
            await c.env.DB
                .prepare(`
                    SELECT
                        ds.signature_key,
                        ds.payment_qr_key
                    FROM document_snapshots ds
                    INNER JOIN documents d
                        ON d.id = ds.document_id
                    WHERE
                        ds.document_id = ?
                        AND ds.company_id = ?
                        AND d.company_id = ?
                    LIMIT 1
                `)
                .bind(
                    params.id,
                    companyId,
                    companyId,
                )
                .first<SnapshotRow>();

        if (!snapshot) {
            return c.json(
                {
                    success: false,
                    message:
                        "Document snapshot not found.",
                },
                404,
            );
        }

        const objectKey =
            params.asset === "signature"
                ? snapshot.signature_key
                : snapshot.payment_qr_key;

        if (!objectKey) {
            return c.json(
                {
                    success: false,
                    message:
                        "Document snapshot asset not found.",
                },
                404,
            );
        }

        const object =
            await c.env.billdesk_files.get(
                objectKey,
            );

        if (!object) {
            return c.json(
                {
                    success: false,
                    message:
                        "Document snapshot asset file not found.",
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