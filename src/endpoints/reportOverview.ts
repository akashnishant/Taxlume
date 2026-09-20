import { OpenAPIRoute } from "chanfana";
import { z } from "zod";
import type { AppContext } from "../types";

const OverviewQuery = z.object({
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

type CompanyRow = {
  currency_code: string;
};

type SalesRow = {
  invoice_count: number;
  taxable_sales_paise: number;
  invoice_total_paise: number;
};

type ReceiptsRow = {
  recorded_receipts_paise: number;
};

type BalancesRow = {
  current_outstanding_paise: number;
  current_overdue_paise: number;
  current_no_due_date_paise: number;
};

type ReceivablesAgingRow = {
  bucket: string;
  invoice_count: number;
  amount_paise: number;
};

type CollectionStatusRow = {
  bucket: "paid" | "partial" | "unpaid";
  invoice_count: number;
  invoice_total_paise: number;
  outstanding_paise: number;
};

type MonthlySalesRow = {
  month: string;
  taxable_sales_paise: number;
  invoice_total_paise: number;
};

type MonthlyReceiptsRow = {
  month: string;
  recorded_receipts_paise: number;
};

type DailySalesRow = {
  date: string;
  taxable_sales_paise: number;
  invoice_total_paise: number;
};

type DailyReceiptsRow = {
  date: string;
  recorded_receipts_paise: number;
};

type TopCustomerRow = {
  party_id: string | null;
  customer_name: string;
  invoice_count: number;
  taxable_sales_paise: number;
  invoice_total_paise: number;
};

type PaymentMethodRow = {
  payment_method: string;
  receipt_count: number;
  amount_paise: number;
};

function parseCalendarDate(value: string): Date | null {
  const date = new Date(`${value}T00:00:00.000Z`);

  if (
    Number.isNaN(date.getTime()) ||
    date.toISOString().slice(0, 10) !== value
  ) {
    return null;
  }

  return date;
}

function getMonthsInRange(
  startDate: Date,
  endDate: Date,
): string[] {
  const months: string[] = [];

  let year = startDate.getUTCFullYear();
  let month = startDate.getUTCMonth();

  const endYear = endDate.getUTCFullYear();
  const endMonth = endDate.getUTCMonth();

  while (
    year < endYear ||
    (year === endYear && month <= endMonth)
  ) {
    months.push(
      `${year}-${String(month + 1).padStart(2, "0")}`,
    );

    month++;

    if (month === 12) {
      month = 0;
      year++;
    }
  }

  return months;
}

function getDaysInRange(
  startDate: Date,
  endDate: Date,
): string[] {
  const days: string[] = [];

  const current = new Date(startDate.getTime());

  while (current <= endDate) {
    days.push(current.toISOString().slice(0, 10));
    current.setUTCDate(current.getUTCDate() + 1);
  }

  return days;
}

export class ReportOverview extends OpenAPIRoute {
  schema = {
    tags: ["Reports"],
    summary: "Get company business analytics overview",
    request: {
      query: OverviewQuery,
    },
    responses: {
      "200": {
        description: "Business analytics retrieved successfully",
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

    const startDate = parseCalendarDate(start_date);
    const endDate = parseCalendarDate(end_date);

    const maximumRangeDays = 731;

    if (
      !startDate ||
      !endDate ||
      startDate > endDate ||
      (endDate.getTime() - startDate.getTime()) /
        86_400_000 + 1 > maximumRangeDays
    ) {
      return c.json(
        {
          success: false,
          message:
            "Select valid dates in chronological order, " +
            "with a reporting period of no more than 731 days.",
        },
        400,
      );
    }

    const company = await c.env.DB
      .prepare(
        `
          SELECT currency_code
          FROM companies
          WHERE id = ?
        `,
      )
      .bind(companyId)
      .first<CompanyRow>();

    if (!company) {
      return c.json(
        {
          success: false,
          message: "Company was not found.",
        },
        404,
      );
    }

    // Version 1 reports only the company's configured currency.
    // It never combines monetary values from different currencies.
    const currencyCode = company.currency_code;

    const sales = await c.env.DB
      .prepare(
        `
          SELECT
            COUNT(*) AS invoice_count,

            COALESCE(
              SUM(taxable_amount_paise),
              0
            ) AS taxable_sales_paise,

            COALESCE(
              SUM(total_paise),
              0
            ) AS invoice_total_paise

          FROM documents

          WHERE company_id = ?
            AND currency_code = ?
            AND document_type = 'TAX_INVOICE'
            AND status = 'ISSUED'
            AND document_date >= ?
            AND document_date <= ?
        `,
      )
      .bind(
        companyId,
        currencyCode,
        start_date,
        end_date,
      )
      .first<SalesRow>();

    // Top customers by issued tax-invoice sales in the
    // selected period and the company's configured currency.
    // This is invoiced sales, not collections or profit.
    const topCustomersResult = await c.env.DB
    .prepare(
        `
        SELECT
            d.party_id,

            COALESCE(
            NULLIF(TRIM(p.display_name), ''),
            'Unassigned customer'
            ) AS customer_name,

            COUNT(*) AS invoice_count,

            COALESCE(
            SUM(d.taxable_amount_paise),
            0
            ) AS taxable_sales_paise,

            COALESCE(
            SUM(d.total_paise),
            0
            ) AS invoice_total_paise

        FROM documents d

        LEFT JOIN parties p
            ON p.id = d.party_id
            AND p.company_id = d.company_id

        WHERE d.company_id = ?
            AND d.currency_code = ?
            AND d.document_type = 'TAX_INVOICE'
            AND d.status = 'ISSUED'
            AND d.document_date >= ?
            AND d.document_date <= ?

        GROUP BY
            d.party_id,
            p.display_name

        ORDER BY
            taxable_sales_paise DESC,
            invoice_total_paise DESC,
            d.party_id ASC

        LIMIT 8
        `,
    )
    .bind(
        companyId,
        currencyCode,
        start_date,
        end_date,
    )
    .all<TopCustomerRow>();

    const receipts = await c.env.DB
      .prepare(
        `
          SELECT
            COALESCE(
              SUM(r.amount_paise),
              0
            ) AS recorded_receipts_paise

          FROM invoice_receipts r

          INNER JOIN documents d
            ON d.id = r.document_id
            AND d.company_id = r.company_id

          WHERE r.company_id = ?
            AND d.currency_code = ?
            AND d.document_type = 'TAX_INVOICE'
            AND d.status = 'ISSUED'
            AND r.status = 'RECORDED'
            AND r.payment_date >= ?
            AND r.payment_date <= ?
        `,
      )
      .bind(
        companyId,
        currencyCode,
        start_date,
        end_date,
      )
      .first<ReceiptsRow>();

    // Currently valid recorded receipts, grouped by payment method.
    // Use the same date, company, currency, and invoice eligibility
    // rules as the period's recorded_receipts_paise metric.
    const paymentMethodsResult = await c.env.DB
    .prepare(
        `
        SELECT
            r.payment_method,

            COUNT(*) AS receipt_count,

            COALESCE(
            SUM(r.amount_paise),
            0
            ) AS amount_paise

        FROM invoice_receipts r

        INNER JOIN documents d
            ON d.id = r.document_id
            AND d.company_id = r.company_id

        WHERE r.company_id = ?
            AND d.currency_code = ?
            AND d.document_type = 'TAX_INVOICE'
            AND d.status = 'ISSUED'
            AND r.status = 'RECORDED'
            AND r.payment_date >= ?
            AND r.payment_date <= ?

        GROUP BY r.payment_method
        `,
    )
    .bind(
        companyId,
        currencyCode,
        start_date,
        end_date,
    )
    .all<PaymentMethodRow>();

    const paymentMethodByCode = new Map(
    paymentMethodsResult.results.map((row) => [
        row.payment_method,
        row,
    ]),
    );

    const collectionsByMethod = [
    { code: "UPI", label: "UPI" },
    { code: "BANK_TRANSFER", label: "Bank transfer" },
    { code: "CASH", label: "Cash" },
    { code: "CARD", label: "Card" },
    { code: "CHEQUE", label: "Cheque" },
    { code: "OTHER", label: "Other" },
    ].map(({ code, label }) => ({
    payment_method: code,
    label,
    receipt_count:
        paymentMethodByCode.get(code)?.receipt_count ?? 0,
    amount_paise:
        paymentMethodByCode.get(code)?.amount_paise ?? 0,
    }));

    const asOfDate = new Date()
      .toISOString()
      .slice(0, 10);

    // These are CURRENT balances across all issued invoices.
    // They are intentionally not filtered by the reporting period.
    const balances = await c.env.DB
      .prepare(
        `
          SELECT
            COALESCE(
              SUM(
                MAX(
                  d.total_paise - d.amount_paid_paise,
                  0
                )
              ),
              0
            ) AS current_outstanding_paise,

            COALESCE(
              SUM(
                CASE
                  WHEN d.due_date IS NOT NULL
                    AND d.due_date < ?
                  THEN MAX(
                    d.total_paise - d.amount_paid_paise,
                    0
                  )
                  ELSE 0
                END
              ),
              0
            ) AS current_overdue_paise,

            COALESCE(
              SUM(
                CASE
                  WHEN d.due_date IS NULL
                  THEN MAX(
                    d.total_paise - d.amount_paid_paise,
                    0
                  )
                  ELSE 0
                END
              ),
              0
            ) AS current_no_due_date_paise

          FROM documents d

          WHERE d.company_id = ?
            AND d.currency_code = ?
            AND d.document_type = 'TAX_INVOICE'
            AND d.status = 'ISSUED'
        `,
      )
      .bind(
        asOfDate,
        companyId,
        currencyCode,
      )
      .first<BalancesRow>();
    // Classify each CURRENT unpaid issued tax invoice exactly once.
    // Buckets are based on its recorded due date, using the same
    // as-of date and currency as current_balances above.
    const agingResult = await c.env.DB
    .prepare(
        `
        SELECT
            bucket,
            COUNT(*) AS invoice_count,
            COALESCE(SUM(outstanding_paise), 0) AS amount_paise
        FROM (
            SELECT
            d.total_paise - d.amount_paid_paise
                AS outstanding_paise,

            CASE
                WHEN d.due_date IS NULL
                THEN 'no_due_date'

                WHEN d.due_date >= ?
                THEN 'not_overdue'

                WHEN d.due_date >= date(?, '-30 days')
                THEN 'overdue_1_30'

                WHEN d.due_date >= date(?, '-60 days')
                THEN 'overdue_31_60'

                WHEN d.due_date >= date(?, '-90 days')
                THEN 'overdue_61_90'

                ELSE 'overdue_91_plus'
            END AS bucket

            FROM documents d

            WHERE d.company_id = ?
            AND d.currency_code = ?
            AND d.document_type = 'TAX_INVOICE'
            AND d.status = 'ISSUED'
            AND d.total_paise > d.amount_paid_paise
        ) eligible_invoices

        GROUP BY bucket
        `,
    )
    .bind(
        asOfDate,
        asOfDate,
        asOfDate,
        asOfDate,
        companyId,
        currencyCode,
    )
    .all<ReceivablesAgingRow>();

    const agingByBucket = new Map(
    agingResult.results.map((row) => [row.bucket, row]),
    );

    const receivablesAging = [
    { bucket: "not_overdue", label: "Not overdue" },
    { bucket: "overdue_1_30", label: "1–30 days overdue" },
    { bucket: "overdue_31_60", label: "31–60 days overdue" },
    { bucket: "overdue_61_90", label: "61–90 days overdue" },
    { bucket: "overdue_91_plus", label: "Over 90 days overdue" },
    { bucket: "no_due_date", label: "No due date" },
    ].map(({ bucket, label }) => ({
    bucket,
    label,
    invoice_count:
        agingByBucket.get(bucket)?.invoice_count ?? 0,
    amount_paise:
        agingByBucket.get(bucket)?.amount_paise ?? 0,
    }));

    // CURRENT collection status across issued tax invoices.
    // Like receivables aging, this is not restricted to the
    // selected sales-reporting period.
    const collectionStatusResult = await c.env.DB
    .prepare(
        `
        WITH classified_invoices AS (
            SELECT
            CASE
                WHEN d.amount_paid_paise >= d.total_paise
                THEN 'paid'
                WHEN d.amount_paid_paise > 0
                THEN 'partial'
                ELSE 'unpaid'
            END AS bucket,

            d.total_paise AS invoice_total_paise,

            MAX(
                d.total_paise - d.amount_paid_paise,
                0
            ) AS outstanding_paise

            FROM documents d

            WHERE d.company_id = ?
            AND d.currency_code = ?
            AND d.document_type = 'TAX_INVOICE'
            AND d.status = 'ISSUED'
            AND d.total_paise > 0
        )

        SELECT
            bucket,
            COUNT(*) AS invoice_count,
            COALESCE(
            SUM(invoice_total_paise),
            0
            ) AS invoice_total_paise,
            COALESCE(
            SUM(outstanding_paise),
            0
            ) AS outstanding_paise

        FROM classified_invoices

        GROUP BY bucket
        `,
    )
    .bind(companyId, currencyCode)
    .all<CollectionStatusRow>();

    const collectionStatusByBucket = new Map(
    collectionStatusResult.results.map((row) => [
        row.bucket,
        row,
    ]),
    );

    const collectionStatus = ([
        { bucket: "paid", label: "Fully paid" },
        { bucket: "partial", label: "Partially paid" },
        { bucket: "unpaid", label: "Unpaid" },
        ] as const).map(({ bucket, label }) => ({
    bucket,
    label,
    invoice_count:
        collectionStatusByBucket.get(bucket)?.invoice_count ?? 0,
    invoice_total_paise:
        collectionStatusByBucket.get(bucket)?.invoice_total_paise ?? 0,
    outstanding_paise:
        collectionStatusByBucket.get(bucket)?.outstanding_paise ?? 0,
    }));

    const monthlySalesResult = await c.env.DB
      .prepare(
        `
          SELECT
            substr(document_date, 1, 7) AS month,

            COALESCE(
              SUM(taxable_amount_paise),
              0
            ) AS taxable_sales_paise,

            COALESCE(
              SUM(total_paise),
              0
            ) AS invoice_total_paise

          FROM documents

          WHERE company_id = ?
            AND currency_code = ?
            AND document_type = 'TAX_INVOICE'
            AND status = 'ISSUED'
            AND document_date >= ?
            AND document_date <= ?

          GROUP BY substr(document_date, 1, 7)
          ORDER BY month
        `,
      )
      .bind(
        companyId,
        currencyCode,
        start_date,
        end_date,
      )
      .all<MonthlySalesRow>();

    const monthlyReceiptsResult = await c.env.DB
      .prepare(
        `
          SELECT
            substr(r.payment_date, 1, 7) AS month,

            COALESCE(
              SUM(r.amount_paise),
              0
            ) AS recorded_receipts_paise

          FROM invoice_receipts r

          INNER JOIN documents d
            ON d.id = r.document_id
            AND d.company_id = r.company_id

          WHERE r.company_id = ?
            AND d.currency_code = ?
            AND d.document_type = 'TAX_INVOICE'
            AND d.status = 'ISSUED'
            AND r.status = 'RECORDED'
            AND r.payment_date >= ?
            AND r.payment_date <= ?

          GROUP BY substr(r.payment_date, 1, 7)
          ORDER BY month
        `,
      )
      .bind(
        companyId,
        currencyCode,
        start_date,
        end_date,
      )
      .all<MonthlyReceiptsRow>();

    const rangeDays =
        (endDate.getTime() - startDate.getTime()) / 86_400_000 + 1;

        let dailyTrend: {
        date: string;
        taxable_sales_paise: number;
        invoice_total_paise: number;
        recorded_receipts_paise: number;
        }[] = [];

        if (rangeDays <= 62) {
        const dailySalesResult = await c.env.DB
            .prepare(
            `
                SELECT
                document_date AS date,
                COALESCE(SUM(taxable_amount_paise), 0)
                    AS taxable_sales_paise,
                COALESCE(SUM(total_paise), 0)
                    AS invoice_total_paise
                FROM documents
                WHERE company_id = ?
                AND currency_code = ?
                AND document_type = 'TAX_INVOICE'
                AND status = 'ISSUED'
                AND document_date >= ?
                AND document_date <= ?
                GROUP BY document_date
                ORDER BY document_date
            `,
            )
            .bind(companyId, currencyCode, start_date, end_date)
            .all<DailySalesRow>();

        const dailyReceiptsResult = await c.env.DB
            .prepare(
            `
                SELECT
                r.payment_date AS date,
                COALESCE(SUM(r.amount_paise), 0)
                    AS recorded_receipts_paise
                FROM invoice_receipts r
                INNER JOIN documents d
                ON d.id = r.document_id
                AND d.company_id = r.company_id
                WHERE r.company_id = ?
                AND d.currency_code = ?
                AND d.document_type = 'TAX_INVOICE'
                AND d.status = 'ISSUED'
                AND r.status = 'RECORDED'
                AND r.payment_date >= ?
                AND r.payment_date <= ?
                GROUP BY r.payment_date
                ORDER BY r.payment_date
            `,
            )
            .bind(companyId, currencyCode, start_date, end_date)
            .all<DailyReceiptsRow>();

        const salesByDate = new Map(
            dailySalesResult.results.map((row) => [row.date, row]),
        );

        const receiptsByDate = new Map(
            dailyReceiptsResult.results.map((row) => [row.date, row]),
        );

        dailyTrend = getDaysInRange(startDate, endDate).map((date) => ({
            date,
            taxable_sales_paise:
            salesByDate.get(date)?.taxable_sales_paise ?? 0,
            invoice_total_paise:
            salesByDate.get(date)?.invoice_total_paise ?? 0,
            recorded_receipts_paise:
            receiptsByDate.get(date)?.recorded_receipts_paise ?? 0,
        }));
        }

    const salesByMonth = new Map(
      monthlySalesResult.results.map((row) => [
        row.month,
        row,
      ]),
    );

    const receiptsByMonth = new Map(
      monthlyReceiptsResult.results.map((row) => [
        row.month,
        row,
      ]),
    );

    // Include months without activity so charts display a
    // continuous timeline rather than skipping empty months.
    const monthlyTrend = getMonthsInRange(
      startDate,
      endDate,
    ).map((month) => ({
      month,
      taxable_sales_paise:
        salesByMonth.get(month)?.taxable_sales_paise ?? 0,
      invoice_total_paise:
        salesByMonth.get(month)?.invoice_total_paise ?? 0,
      recorded_receipts_paise:
        receiptsByMonth.get(month)
          ?.recorded_receipts_paise ?? 0,
    }));

    return c.json({
      success: true,

      filters: {
        start_date,
        end_date,
        currency_code: currencyCode,
      },

      period_metrics: {
        invoice_count: sales?.invoice_count ?? 0,
        taxable_sales_paise:
          sales?.taxable_sales_paise ?? 0,
        invoice_total_paise:
          sales?.invoice_total_paise ?? 0,
        recorded_receipts_paise:
          receipts?.recorded_receipts_paise ?? 0,
      },

      current_balances: {
        as_of_date: asOfDate,
        outstanding_paise:
          balances?.current_outstanding_paise ?? 0,
        overdue_paise:
          balances?.current_overdue_paise ?? 0,
        no_due_date_paise:
          balances?.current_no_due_date_paise ?? 0,
      },

      receivables_aging: receivablesAging,
      collection_status: collectionStatus,

      monthly_trend: monthlyTrend,
      daily_trend: dailyTrend,

      top_customers: topCustomersResult.results,
      collections_by_method: collectionsByMethod,
    });
  }
}