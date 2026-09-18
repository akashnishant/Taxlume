import { OpenAPIRoute } from "chanfana";
import { z } from "zod";
import { type AppContext } from "../types";

const DocumentListQuery = z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    document_type: z
        .enum([
            "TAX_INVOICE",
            "PROFORMA_INVOICE",
            "PURCHASE_ORDER",
            "QUOTATION",
            "DELIVERY_CHALLAN",
        ])
        .optional(),
    status: z
        .enum(["DRAFT", "ISSUED", "CANCELLED"])
        .optional(),
    search: z.string().trim().max(100).optional(),
});

type DocumentRow = {
    id: string;
    document_type: string;
    document_number: string;
    document_date: string;
    due_date: string | null;
    party_id: string | null;
    party_name: string | null;
    status: string;
    currency_code: string;
    subtotal_paise: number;
    discount_paise: number;
    taxable_amount_paise: number;
    cgst_paise: number;
    sgst_paise: number;
    igst_paise: number;
    cess_paise: number;
    round_off_paise: number;
    total_paise: number;
    amount_paid_paise: number;
    created_at: string;
    updated_at: string;
};

export class DocumentList extends OpenAPIRoute {
    schema = {
        tags: ["Documents"],
        summary: "List billing documents",
        request: {
            query: DocumentListQuery,
        },
        responses: {
            "200": {
                description: "Documents retrieved successfully",
            },
            "401": {
                description: "Authentication required",
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

        const query =
            await this.getValidatedData<typeof this.schema>();

        const {
            page,
            limit,
            document_type,
            status,
            search,
        } = query.query;

        const offset = (page - 1) * limit;

        const conditions = [
            "d.company_id = ?",
        ];

        const bindings: (string | number)[] = [
            companyId,
        ];

        if (document_type) {
            conditions.push(
                "d.document_type = ?",
            );
            bindings.push(document_type);
        }

        if (status) {
            conditions.push("d.status = ?");
            bindings.push(status);
        }

        if (search) {
            conditions.push(
                "d.document_number LIKE ?",
            );
            bindings.push(`%${search}%`);
        }

        const whereClause =
            conditions.join(" AND ");

        const countResult = await c.env.DB
            .prepare(`
				SELECT COUNT(*) AS total
				FROM documents d
				WHERE ${whereClause}
			`)
            .bind(...bindings)
            .first<{ total: number }>();

        const total =
            countResult?.total ?? 0;

        const documents = await c.env.DB
            .prepare(`
				SELECT
					d.id,
					d.document_type,
					d.document_number,
					d.document_date,
					d.due_date,
					d.party_id,
					p.display_name AS party_name,
					d.status,
					d.currency_code,
					d.subtotal_paise,
					d.discount_paise,
					d.taxable_amount_paise,
					d.cgst_paise,
					d.sgst_paise,
					d.igst_paise,
					d.cess_paise,
					d.round_off_paise,
					d.total_paise,
					d.amount_paid_paise,
					d.created_at,
					d.updated_at
				FROM documents d
				LEFT JOIN parties p
					ON p.id = d.party_id
					AND p.company_id = d.company_id
				WHERE ${whereClause}
				ORDER BY
					d.document_date DESC,
					d.created_at DESC
				LIMIT ? OFFSET ?
			`)
            .bind(
                ...bindings,
                limit,
                offset,
            )
            .all<DocumentRow>();

        const totalPages =
            total === 0
                ? 0
                : Math.ceil(total / limit);

        return c.json({
            success: true,
            documents: documents.results,
            pagination: {
                page,
                limit,
                total,
                total_pages: totalPages,
            },
        });
    }
}