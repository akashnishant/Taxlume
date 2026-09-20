import { OpenAPIRoute } from "chanfana";
import { z } from "zod";
import type { AppContext } from "../types";

const InvoiceReceiptListParams = z.object({
  id: z.string().uuid(),
});

type InvoiceRow = {
  id: string;
  document_number: string;
  status: string;
  currency_code: string;
  total_paise: number;
  amount_paid_paise: number;
};

type ReceiptRow = {
  id: string;
  amount_paise: number;
  payment_date: string;
  payment_method: string;
  reference_number: string | null;
  notes: string | null;
  status: "RECORDED" | "REVERSED";
  created_by: string;
  created_at: string;
  reversed_by: string | null;
  reversed_at: string | null;
  reversal_reason: string | null;
};

export class InvoiceReceiptList extends OpenAPIRoute {
  schema = {
    tags: ["Invoice Payments"],
    summary: "List customer receipts recorded against a tax invoice",
    request: {
      params: InvoiceReceiptListParams,
    },
    responses: {
      "200": {
        description: "Invoice receipt history retrieved successfully",
      },
      "401": {
        description: "Authentication required",
      },
      "404": {
        description: "Tax invoice not found",
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

    const { id } = validated.params;

    const invoice = await c.env.DB
      .prepare(
        `
          SELECT
            id,
            document_number,
            status,
            currency_code,
            total_paise,
            amount_paid_paise
          FROM documents
          WHERE id = ?
            AND company_id = ?
            AND document_type = 'TAX_INVOICE'
          LIMIT 1
        `,
      )
      .bind(id, companyId)
      .first<InvoiceRow>();

    if (!invoice) {
      return c.json(
        {
          success: false,
          message: "Tax invoice not found.",
        },
        404,
      );
    }

    const result = await c.env.DB
      .prepare(
        `
          SELECT
            id,
            amount_paise,
            payment_date,
            payment_method,
            reference_number,
            notes,
            status,
            created_by,
            created_at,
            reversed_by,
            reversed_at,
            reversal_reason
          FROM invoice_receipts
          WHERE company_id = ?
            AND document_id = ?
          ORDER BY created_at DESC, id DESC
        `,
      )
      .bind(companyId, id)
      .all<ReceiptRow>();

    return c.json({
      success: true,
      invoice: {
        id: invoice.id,
        document_number: invoice.document_number,
        status: invoice.status,
        currency_code: invoice.currency_code,
        total_paise: invoice.total_paise,
        amount_paid_paise: invoice.amount_paid_paise,
        outstanding_paise: Math.max(
          0,
          invoice.total_paise - invoice.amount_paid_paise,
        ),
      },
      receipts: result.results,
    });
  }
}