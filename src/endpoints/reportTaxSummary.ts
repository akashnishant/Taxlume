import { OpenAPIRoute } from "chanfana";
import { z } from "zod";
import type { AppContext } from "../types";

const TaxSummaryQuery = z.object({
  start_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD for start_date."),
  end_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD for end_date."),
});

type MonthlyTaxRow = {
  month: string;
  currency_code: string;
  document_count: number;
  taxable_amount_paise: number;
  cgst_paise: number;
  sgst_paise: number;
  igst_paise: number;
  cess_paise: number;
  total_paise: number;
};

function isValidCalendarDate(value: string): boolean {
  const parsed = new Date(`${value}T00:00:00Z`);

  return (
    !Number.isNaN(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === value
  );
}

export class ReportTaxSummary extends OpenAPIRoute {
  schema = {
    tags: ["Reports"],
    summary: "Get monthly tax summary from issued tax invoices",
    request: {
      query: TaxSummaryQuery,
    },
    responses: {
      "200": {
        description: "Document tax summary retrieved successfully",
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

    const { start_date, end_date } = validated.query;

    if (
      !isValidCalendarDate(start_date) ||
      !isValidCalendarDate(end_date) ||
      start_date > end_date
    ) {
      return c.json(
        {
          success: false,
          message: "Please select a valid reporting date range.",
        },
        400,
      );
    }

    const result = await c.env.DB
      .prepare(
        `
          SELECT
            substr(d.document_date, 1, 7) AS month,
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
            AND d.document_type = 'TAX_INVOICE'
            AND d.status = 'ISSUED'
            AND d.document_date >= ?
            AND d.document_date <= ?
          GROUP BY
            substr(d.document_date, 1, 7),
            d.currency_code
          ORDER BY
            month DESC,
            d.currency_code ASC
        `,
      )
      .bind(companyId, start_date, end_date)
      .all<MonthlyTaxRow>();

    return c.json({
      success: true,
      filters: {
        start_date,
        end_date,
      },
      monthly_by_currency: result.results,
    });
  }
}