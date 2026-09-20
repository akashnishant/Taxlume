import { OpenAPIRoute } from "chanfana";
import { z } from "zod";
import type { AppContext } from "../types";

const InvoiceReceiptCreateParams = z.object({
  id: z.string().uuid(),
});

const InvoiceReceiptCreateRequest = z.object({
  client_request_id: z.string().uuid(),
  amount_paise: z.number().int().safe().positive(),
  payment_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD for payment_date."),
  payment_method: z.enum([
    "CASH",
    "UPI",
    "BANK_TRANSFER",
    "CHEQUE",
    "CARD",
    "OTHER",
  ]),
  reference_number: z.string().trim().max(120).optional(),
  notes: z.string().trim().max(500).optional(),
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

type ExistingRequestRow = ReceiptRow & {
  document_id: string;
};

function isValidCalendarDate(value: string): boolean {
  const parsed = new Date(`${value}T00:00:00Z`);

  return (
    !Number.isNaN(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === value
  );
}

export class InvoiceReceiptCreate extends OpenAPIRoute {
  schema = {
    tags: ["Invoice Payments"],
    summary: "Record a customer payment against an issued tax invoice",
    request: {
      params: InvoiceReceiptCreateParams,
      body: {
        content: {
          "application/json": {
            schema: InvoiceReceiptCreateRequest,
          },
        },
      },
    },
    responses: {
      "200": {
        description: "Existing receipt returned for a repeated submission",
      },
      "201": {
        description: "Customer payment recorded successfully",
      },
      "400": {
        description: "Invalid payment details",
      },
      "401": {
        description: "Authentication required",
      },
      "404": {
        description: "Tax invoice not found",
      },
      "409": {
        description: "Invoice is ineligible or submission ID was reused",
      },
      "500": {
        description: "Unable to confirm the payment outcome",
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

    const { id: invoiceId } = validated.params;

    const {
      client_request_id,
      amount_paise,
      payment_date,
      payment_method,
      reference_number,
      notes,
    } = validated.body;

    if (!isValidCalendarDate(payment_date)) {
      return c.json(
        {
          success: false,
          message: "Please enter a valid payment date.",
        },
        400,
      );
    }

    const normalizedReference = reference_number?.trim() || null;
    const normalizedNotes = notes?.trim() || null;

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
      .bind(invoiceId, companyId)
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

    // A request ID is unique per company, not merely per invoice.
    // Look it up BEFORE checking the current outstanding balance:
    // the original payment may have already paid the invoice in full.
    async function findExistingRequest() {
      return c.env.DB
        .prepare(
          `
            SELECT
              id,
              document_id,
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
              AND client_request_id = ?
            LIMIT 1
          `,
        )
        .bind(companyId, client_request_id)
        .first<ExistingRequestRow>();
    }

    function matchesSubmittedPayment(
      receipt: ExistingRequestRow,
    ): boolean {
      return (
        receipt.document_id === invoiceId &&
        receipt.amount_paise === amount_paise &&
        receipt.payment_date === payment_date &&
        receipt.payment_method === payment_method &&
        receipt.reference_number === normalizedReference &&
        receipt.notes === normalizedNotes
      );
    }

    let existing = await findExistingRequest();

    if (existing && !matchesSubmittedPayment(existing)) {
      return c.json(
        {
          success: false,
          message:
            "This payment submission ID was already used for different payment details. Start a new submission.",
        },
        409,
      );
    }

    if (existing?.status === "REVERSED") {
      return c.json(
        {
          success: false,
          message:
            "This payment submission was already recorded and later reversed. Refresh Payment History before proceeding.",
        },
        409,
      );
    }

    let receiptId = existing?.id ?? crypto.randomUUID();
    let isReplay = existing !== null;

    if (!existing) {
      if (invoice.status !== "ISSUED") {
        return c.json(
          {
            success: false,
            message:
              "Payments can only be recorded against issued tax invoices.",
          },
          409,
        );
      }

      const outstandingPaise =
        invoice.total_paise - invoice.amount_paid_paise;

      if (outstandingPaise <= 0) {
        return c.json(
          {
            success: false,
            message: "This invoice has no outstanding balance.",
          },
          409,
        );
      }

      if (amount_paise > outstandingPaise) {
        return c.json(
          {
            success: false,
            message:
              "Payment amount cannot exceed the outstanding balance.",
          },
          409,
        );
      }

      const now = new Date().toISOString();

      try {
        // The database trigger validates the CURRENT invoice balance
        // and increments amount_paid_paise in this same INSERT.
        await c.env.DB
          .prepare(
            `
              INSERT INTO invoice_receipts (
                id,
                company_id,
                document_id,
                client_request_id,
                amount_paise,
                payment_date,
                payment_method,
                reference_number,
                notes,
                status,
                created_by,
                created_at
              )
              VALUES (
                ?, ?, ?, ?, ?, ?, ?, ?, ?, 'RECORDED', ?, ?
              )
            `,
          )
          .bind(
            receiptId,
            companyId,
            invoiceId,
            client_request_id,
            amount_paise,
            payment_date,
            payment_method,
            normalizedReference,
            normalizedNotes,
            userId,
            now,
          )
          .run();
      } catch (error) {
        // Another request carrying the same ID may have completed
        // between our initial lookup and INSERT. Look it up again
        // before deciding whether this request failed.
        try {
          existing = await findExistingRequest();
        } catch (lookupError) {
          console.error(
            "Unable to check payment submission after INSERT error:",
            lookupError,
          );

          return c.json(
            {
              success: false,
              message:
                "Unable to confirm whether the payment was recorded. Refresh Payment History before trying again.",
            },
            500,
          );
        }

        if (existing) {
          if (!matchesSubmittedPayment(existing)) {
            return c.json(
              {
                success: false,
                message:
                  "This payment submission ID was already used for different payment details. Start a new submission.",
              },
              409,
            );
          }

          if (existing.status === "REVERSED") {
            return c.json(
              {
                success: false,
                message:
                  "This payment submission was already recorded and later reversed. Refresh Payment History before proceeding.",
              },
              409,
            );
          }

          receiptId = existing.id;
          isReplay = true;
        } else {
          const message =
            error instanceof Error ? error.message : String(error);

          if (
            message.includes(
              "Invoice is not eligible for this receipt or has insufficient outstanding balance.",
            ) ||
            message.includes(
              "New receipts must have RECORDED status.",
            )
          ) {
            return c.json(
              {
                success: false,
                message:
                  "The invoice status or outstanding balance has changed. Refresh the invoice before recording a payment.",
              },
              409,
            );
          }

          console.error("Unable to record invoice receipt:", error);

          return c.json(
            {
              success: false,
              message:
                "Unable to confirm whether the payment was recorded. Refresh Payment History before trying again.",
            },
            500,
          );
        }
      }
    }

    // Fetch the CURRENT receipt and balance for both a new submission
    // and a replay. Do not add the payment to the balance again.
    let receipt: ReceiptRow | null;
    let updatedInvoice: InvoiceRow | null;

    try {
      [receipt, updatedInvoice] = await Promise.all([
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
                AND company_id = ?
                AND document_id = ?
              LIMIT 1
            `,
          )
          .bind(receiptId, companyId, invoiceId)
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
    } catch (error) {
      console.error(
        "Unable to retrieve payment submission result:",
        error,
      );

      return c.json(
        {
          success: false,
          message:
            "Unable to retrieve the payment result. Refresh Payment History before trying again.",
        },
        500,
      );
    }

    if (!receipt || !updatedInvoice) {
      return c.json(
        {
          success: false,
          message:
            "Unable to retrieve the payment result. Refresh Payment History before trying again.",
        },
        500,
      );
    }

    // Do not report a reversed receipt as a successful payment replay.
    if (receipt.status !== "RECORDED") {
      return c.json(
        {
          success: false,
          message:
            "This receipt has been reversed. Refresh Payment History before proceeding.",
        },
        409,
      );
    }

    return c.json(
      {
        success: true,
        message: isReplay
          ? "This payment was already recorded. Existing receipt returned."
          : "Payment recorded successfully.",
        already_recorded: isReplay,
        receipt,
        invoice: {
          id: updatedInvoice.id,
          document_number: updatedInvoice.document_number,
          status: updatedInvoice.status,
          currency_code: updatedInvoice.currency_code,
          total_paise: updatedInvoice.total_paise,
          amount_paid_paise: updatedInvoice.amount_paid_paise,
          outstanding_paise: Math.max(
            0,
            updatedInvoice.total_paise -
              updatedInvoice.amount_paid_paise,
          ),
        },
      },
      isReplay ? 200 : 201,
    );
  }
}