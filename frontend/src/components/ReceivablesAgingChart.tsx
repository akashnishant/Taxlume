import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { AnalyticsAgingBucket } from "../services/analyticsApi";
import { chartColors } from "../theme/brandColors";

type Props = {
  aging: AnalyticsAgingBucket[];
  currencyCode: string;
  asOfDate: string;
  compactMobile?: boolean;
};

const BUCKET_COLORS: Record<AnalyticsAgingBucket["bucket"], string> = {
  not_overdue: chartColors.collections,
  overdue_1_30: chartColors.warning,
  overdue_31_60: chartColors.warningStrong,
  overdue_61_90: chartColors.danger,
  overdue_91_plus: chartColors.dangerStrong,
  no_due_date: chartColors.muted,
};

function formatMoney(amountPaise: number, currencyCode: string): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: currencyCode,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amountPaise / 100);
}

function formatCompactMoney(amount: number, currencyCode: string): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: currencyCode,
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(amount);
}

export default function ReceivablesAgingChart({
  aging,
  currencyCode,
  asOfDate,
  compactMobile = false,
}: Props) {
  const totalOutstandingPaise = aging.reduce(
    (total, row) => total + row.amount_paise,
    0,
  );

  const unpaidInvoiceCount = aging.reduce(
    (total, row) => total + row.invoice_count,
    0,
  );

  const chartData = aging.map((row) => ({
    ...row,
    amount_rupees: row.amount_paise / 100,
  }));

  return (
    <section
      className={`min-w-0 rounded-2xl border border-slate-200 bg-white shadow-sm ${
        compactMobile ? "p-4 sm:p-5" : "p-5"
      }`}
      aria-labelledby="receivables-aging-heading"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h3
            id="receivables-aging-heading"
            className="text-lg font-bold text-slate-900"
          >
            Receivables aging
          </h3>

          <p
            className={
              compactMobile
                ? "mt-1 text-xs leading-5 text-slate-500 sm:text-sm sm:leading-6"
                : "mt-1 text-sm leading-6 text-slate-500"
            }
          >
            Current unpaid invoice balances grouped by due date. These figures
            are not restricted to the selected sales period.
          </p>
        </div>

        <div
          className={
            compactMobile
              ? "rounded-xl bg-slate-50 px-3 py-2 sm:px-4 sm:py-3 sm:text-right"
              : "rounded-xl bg-slate-50 px-4 py-3 sm:text-right"
          }
        >
          <p className="text-xs font-medium text-slate-500">
            Total outstanding
          </p>

          <p className="mt-1 text-xl font-bold text-slate-900">
            {formatMoney(totalOutstandingPaise, currencyCode)}
          </p>

          <p className="mt-1 text-xs text-slate-500">
            {unpaidInvoiceCount} unpaid{" "}
            {unpaidInvoiceCount === 1 ? "invoice" : "invoices"}
          </p>
        </div>
      </div>

      {totalOutstandingPaise === 0 ? (
        <div className="mt-6 flex min-h-48 items-center justify-center rounded-xl bg-slate-50 px-5 text-center text-sm text-slate-500">
          No outstanding issued invoices in {currencyCode}.
        </div>
      ) : (
        <>
          <div
            className={
              compactMobile
                ? "mt-4 h-[220px] w-full min-w-0 sm:mt-6 sm:h-[310px]"
                : "mt-6 h-[310px] w-full min-w-0"
            }
            role="img"
            aria-label={`Receivables aging chart showing ${formatMoney(
              totalOutstandingPaise,
              currencyCode,
            )} outstanding across ${unpaidInvoiceCount} invoices`}
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={chartData}
                layout="vertical"
                margin={{
                  top: 5,
                  right: 12,
                  bottom: 5,
                  left: 0,
                }}
                barCategoryGap="28%"
              >
                <CartesianGrid
                  stroke={chartColors.grid}
                  strokeDasharray="3 3"
                  horizontal={false}
                />

                <XAxis
                  type="number"
                  tickFormatter={(value: number) =>
                    formatCompactMoney(value, currencyCode)
                  }
                  tick={{ fontSize: 11, fill: chartColors.axis }}
                  axisLine={false}
                  tickLine={false}
                />

                <YAxis
                  type="category"
                  dataKey="label"
                  width={compactMobile ? 108 : 142}
                  interval={0}
                  tick={{ fontSize: 11, fill: chartColors.axis }}
                  axisLine={false}
                  tickLine={false}
                />

                <Tooltip
                  formatter={(value) =>
                    formatMoney(
                      Math.round(Number(value ?? 0) * 100),
                      currencyCode,
                    )
                  }
                />

                <Bar
                  dataKey="amount_rupees"
                  name="Outstanding"
                  radius={[0, 6, 6, 0]}
                  maxBarSize={22}
                >
                  {chartData.map((row) => (
                    <Cell key={row.bucket} fill={BUCKET_COLORS[row.bucket]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div
            className={
              compactMobile
                ? "mt-3 grid grid-cols-2 gap-2 sm:mt-4"
                : "mt-4 grid gap-2 sm:grid-cols-2"
            }
          >
            {aging.map((row) => (
              <div
                key={row.bucket}
                className={
                  compactMobile
                    ? "flex min-w-0 flex-col items-start gap-1 rounded-xl border border-slate-100 bg-slate-50 p-2.5 sm:flex-row sm:items-center sm:justify-between sm:gap-3 sm:px-3 sm:py-3"
                    : "flex min-w-0 items-center justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50 px-3 py-3"
                }
              >
                <div className="flex min-w-0 items-center gap-2">
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{
                      backgroundColor: BUCKET_COLORS[row.bucket],
                    }}
                    aria-hidden="true"
                  />

                  <div className="min-w-0">
                    <p className="text-xs font-medium text-slate-700">
                      {row.label}
                    </p>

                    <p className="mt-0.5 text-xs text-slate-500">
                      {row.invoice_count}{" "}
                      {row.invoice_count === 1 ? "invoice" : "invoices"}
                    </p>
                  </div>
                </div>

                <p className="shrink-0 text-xs font-semibold text-slate-900">
                  {formatMoney(row.amount_paise, currencyCode)}
                </p>
              </div>
            ))}
          </div>
        </>
      )}

      <p
        className={
          compactMobile
            ? "mt-4 text-[11px] leading-4 text-slate-500 sm:mt-5 sm:text-xs sm:leading-5"
            : "mt-5 text-xs leading-5 text-slate-500"
        }
      >
        As of {asOfDate}. Invoices without a due date are shown separately
        rather than treated as overdue.
      </p>
    </section>
  );
}
