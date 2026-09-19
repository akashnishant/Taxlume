import { OpenAPIRoute } from "chanfana";
import { z } from "zod";
import type { AppContext } from "../types";

const PurchaseOrderRegisterQuery = z.object({
  start_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD for start_date."),

  end_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD for end_date."),

  page: z.coerce.number().int().min(1).default(1),
});

type PurchaseOrderSummaryRow = {
  currency_code: string;
  document_count: number;
  taxable_amount_paise: number;
  cgst_paise: number;
  sgst_paise: number;
  igst_paise: number;
  cess_paise: number;
  total_paise: number;
};

type PurchaseOrderDocumentRow = {
  id: string;
  document_number: string;
  document_date: string;
  party_name: string | null;
  currency_code: string;
  taxable_amount_paise: number;
  cgst_paise: number;
  sgst_paise: number;
  igst_paise: number;
  cess_paise: number;
  total_paise: number;
};

const PAGE_SIZE = 25;

export class ReportPurchaseOrderRegister extends OpenAPIRoute {
  schema = {
    tags: ["Reports"],
    summary: "Get issued purchase order register",
    request: {
      query: PurchaseOrderRegisterQuery,
    },
    responses: {
      "200": {
        description: "Purchase order register retrieved successfully",
      },
      "400": {
        description: "Invalid reporting date range",
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
          message: "Authentication context is missing.",
        },
        401,
      );
    }

    const validated =
      await this.getValidatedData<typeof this.schema>();

    const { start_date, end_date, page } = validated.query;

    if (
      start_date > end_date ||
      Number.isNaN(Date.parse(`${start_date}T00:00:00Z`)) ||
      Number.isNaN(Date.parse(`${end_date}T00:00:00Z`))
    ) {
      return c.json(
        {
          success: false,
          message: "Please select a valid reporting date range.",
        },
        400,
      );
    }

    const bindings = [companyId, start_date, end_date];

    const summaryResult = await c.env.DB
      .prepare(
        `
          SELECT
            d.currency_code,
            COUNT(*) AS document_count,
            COALESCE(SUM(d.taxable_amount_paise), 0)
              AS taxable_amount_paise,
            COALESCE(SUM(d.cgst_paise), 0)
              AS cgst_paise,
            COALESCE(SUM(d.sgst_paise), 0)
              AS sgst_paise,
            COALESCE(SUM(d.igst_paise), 0)
              AS igst_paise,
            COALESCE(SUM(d.cess_paise), 0)
              AS cess_paise,
            COALESCE(SUM(d.total_paise), 0)
              AS total_paise
          FROM documents d
          WHERE d.company_id = ?
            AND d.document_type = 'PURCHASE_ORDER'
            AND d.status = 'ISSUED'
            AND d.document_date >= ?
            AND d.document_date <= ?
          GROUP BY d.currency_code
          ORDER BY d.currency_code
        `,
      )
      .bind(...bindings)
      .all<PurchaseOrderSummaryRow>();

    const summaryByCurrency = summaryResult.results;

    const totalDocuments = summaryByCurrency.reduce(
      (total, row) => total + row.document_count,
      0,
    );

    const offset = (page - 1) * PAGE_SIZE;

    const documentResult = await c.env.DB
      .prepare(
        `
          SELECT
            d.id,
            d.document_number,
            d.document_date,
            p.display_name AS party_name,
            d.currency_code,
            d.taxable_amount_paise,
            d.cgst_paise,
            d.sgst_paise,
            d.igst_paise,
            d.cess_paise,
            d.total_paise
          FROM documents d
          LEFT JOIN parties p
            ON p.id = d.party_id
            AND p.company_id = d.company_id
          WHERE d.company_id = ?
            AND d.document_type = 'PURCHASE_ORDER'
            AND d.status = 'ISSUED'
            AND d.document_date >= ?
            AND d.document_date <= ?
          ORDER BY
            d.document_date DESC,
            d.created_at DESC,
            d.id DESC
          LIMIT ? OFFSET ?
        `,
      )
      .bind(...bindings, PAGE_SIZE, offset)
      .all<PurchaseOrderDocumentRow>();

    return c.json({
      success: true,
      filters: {
        start_date,
        end_date,
      },
      summary_by_currency: summaryByCurrency,
      documents: documentResult.results,
      pagination: {
        page,
        limit: PAGE_SIZE,
        total: totalDocuments,
        total_pages:
          totalDocuments === 0
            ? 0
            : Math.ceil(totalDocuments / PAGE_SIZE),
      },
    });
  }
}