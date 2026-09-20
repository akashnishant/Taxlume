import { OpenAPIRoute } from "chanfana";
import { z } from "zod";
import type { AppContext } from "../types";

const ReverseReceiptParams = z.object({
  id: z.string().uuid(),
  receiptId: z.string().uuid(),
});

const ReverseReceiptRequest = z.object({
  reason: z.string().trim().min(3).max(500),
});

type ReceiptWithInvoiceRow = {
  id: string;
  status: "RECORDED" | "REVERSED";
  amount_paise: number;
  invoice_status: string;
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

type InvoiceRow = {
  id: string;
  document_number: string;
  status: string;
  currency_code: string;
  total_paise: number;
  amount_paid_paise: number;
};

export class InvoiceReceiptReverse extends OpenAPIRoute {
  schema = {
    tags: ["Invoice Payments"],
    summary: "Reverse an incorrectly recorded customer receipt",
    request: {
      params: ReverseReceiptParams,
      body: {
        content: {
          "application/json": {
            schema: ReverseReceiptRequest,
          },
        },
      },
    },
    responses: {
      "200": {
        description: "Receipt reversed successfully",
      },
      "400": {
        description: "Invalid reversal reason",
      },
      "401": {
        description: "Authentication required",
      },
      "404": {
        description: "Invoice or receipt not found",
      },
      "409": {
        description: "Receipt cannot be reversed",
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
          message: "Authentication context is missing.",
        },
        401,
      );
    }

    const validated =
      await this.getValidatedData<typeof this.schema>();

    const { id: invoiceId, receiptId } = validated.params;
    const reason = validated.body.reason.trim();

    const existingReceipt = await c.env.DB
      .prepare(
        `
          SELECT
            r.id,
            r.status,
            r.amount_paise,
            d.status AS invoice_status,
            d.amount_paid_paise
          FROM invoice_receipts r
          INNER JOIN documents d
            ON d.id = r.document_id
            AND d.company_id = r.company_id
          WHERE r.id = ?
            AND r.document_id = ?
            AND r.company_id = ?
            AND d.document_type = 'TAX_INVOICE'
          LIMIT 1
        `,
      )
      .bind(receiptId, invoiceId, companyId)
      .first<ReceiptWithInvoiceRow>();

    if (!existingReceipt) {
      return c.json(
        {
          success: false,
          message: "Invoice receipt not found.",
        },
        404,
      );
    }

    if (existingReceipt.status !== "RECORDED") {
      return c.json(
        {
          success: false,
          message: "This receipt has already been reversed.",
        },
        409,
      );
    }

    if (
      existingReceipt.invoice_status !== "ISSUED" ||
      existingReceipt.amount_paid_paise <
        existingReceipt.amount_paise
    ) {
      return c.json(
        {
          success: false,
          message:
            "This receipt cannot be reversed in the invoice's current state.",
        },
        409,
      );
    }

    const reversedAt = new Date().toISOString();

    try {
      /*
       * The database trigger validates the current invoice state
       * and restores the outstanding balance as part of this UPDATE.
       *
       * Do not separately update documents.amount_paid_paise here.
       */
      const result = await c.env.DB
        .prepare(
            `
            UPDATE invoice_receipts
            SET
                status = 'REVERSED',
                reversed_by = ?,
                reversed_at = ?,
                reversal_reason = ?
            WHERE id = ?
                AND document_id = ?
                AND company_id = ?
                AND status = 'RECORDED'
            RETURNING id
            `,
        )
        .bind(
            userId,
            reversedAt,
            reason,
            receiptId,
            invoiceId,
            companyId,
        )
        .all<{ id: string }>();

        if (result.results.length !== 1) {
            return c.json(
            {
                success: false,
                message:
                "The receipt has changed. Refresh its payment history before trying again.",
            },
            409,
            );
        }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : String(error);

      if (
        message.includes("Invalid receipt reversal.") ||
        message.includes(
          "Invoice is not eligible for receipt reversal.",
        )
      ) {
        return c.json(
          {
            success: false,
            message:
              "This receipt cannot be reversed in the invoice's current state. Refresh the payment history.",
          },
          409,
        );
      }

      // Unexpected database errors should not be presented as
      // ordinary validation errors.
      throw error;
    }

    const [receipt, invoice] = await Promise.all([
      c.env.DB
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
            WHERE id = ?
              AND document_id = ?
              AND company_id = ?
            LIMIT 1
          `,
        )
        .bind(receiptId, invoiceId, companyId)
        .first<ReceiptRow>(),

      c.env.DB
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
        .bind(invoiceId, companyId)
        .first<InvoiceRow>(),
    ]);

    if (!receipt || !invoice) {
      return c.json(
        {
          success: false,
          message:
            "The reversal was submitted, but its updated details could not be retrieved. Refresh the invoice before trying again.",
        },
        500,
      );
    }

    return c.json({
      success: true,
      message: "Receipt reversed successfully.",
      receipt,
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
    });
  }
}