import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import type { AnalyticsCollectionStatus } from "../services/analyticsApi";

type Props = {
  statuses: AnalyticsCollectionStatus[];
  currencyCode: string;
  asOfDate: string;
};

const STATUS_COLORS: Record<AnalyticsCollectionStatus["bucket"], string> = {
  paid: "#10b981",
  partial: "#6366f1",
  unpaid: "#f59e0b",
};

function formatMoney(amountPaise: number, currencyCode: string): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: currencyCode,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amountPaise / 100);
}

export default function InvoiceCollectionStatusChart({
  statuses,
  currencyCode,
  asOfDate,
}: Props) {
  const totalInvoices = statuses.reduce(
    (total, row) => total + row.invoice_count,
    0,
  );

  const totalOutstandingPaise = statuses.reduce(
    (total, row) => total + row.outstanding_paise,
    0,
  );

  const chartData = statuses.filter((row) => row.invoice_count > 0);

  return (
    <section
      className="min-w-0 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
      aria-labelledby="collection-status-heading"
    >
      <div>
        <h3
          id="collection-status-heading"
          className="text-lg font-bold text-slate-900"
        >
          Invoice collection status
        </h3>

        <p className="mt-1 text-sm leading-6 text-slate-500">
          Current payment status of issued tax invoices. The chart represents
          invoice counts, not payment amounts.
        </p>
      </div>

      {totalInvoices === 0 ? (
        <div className="mt-6 flex min-h-56 items-center justify-center rounded-xl bg-slate-50 px-5 text-center text-sm text-slate-500">
          No positive-value issued tax invoices in {currencyCode}.
        </div>
      ) : (
        <>
          <div className="relative mt-4 h-64 min-w-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartData}
                  dataKey="invoice_count"
                  nameKey="label"
                  cx="50%"
                  cy="50%"
                  innerRadius={68}
                  outerRadius={94}
                  paddingAngle={2}
                  stroke="#ffffff"
                  strokeWidth={2}
                >
                  {chartData.map((row) => (
                    <Cell key={row.bucket} fill={STATUS_COLORS[row.bucket]} />
                  ))}
                </Pie>

                <Tooltip
                  formatter={(value) => {
                    const count = Number(value ?? 0);

                    return `${count} ${count === 1 ? "invoice" : "invoices"}`;
                  }}
                />
              </PieChart>
            </ResponsiveContainer>

            <div
              className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center"
              aria-hidden="true"
            >
              <p className="text-3xl font-bold tracking-tight text-slate-900">
                {totalInvoices}
              </p>

              <p className="text-xs font-medium text-slate-500">
                {totalInvoices === 1 ? "Invoice" : "Invoices"}
              </p>
            </div>
          </div>

          <div className="space-y-2">
            {statuses.map((row) => {
              const percentage =
                totalInvoices > 0
                  ? (row.invoice_count / totalInvoices) * 100
                  : 0;

              return (
                <div
                  key={row.bucket}
                  className="rounded-xl border border-slate-100 bg-slate-50 p-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{
                          backgroundColor: STATUS_COLORS[row.bucket],
                        }}
                        aria-hidden="true"
                      />

                      <p className="text-sm font-semibold text-slate-800">
                        {row.label}
                      </p>
                    </div>

                    <p className="text-sm font-semibold text-slate-900">
                      {row.invoice_count}{" "}
                      <span className="font-normal text-slate-500">
                        ({percentage.toFixed(0)}%)
                      </span>
                    </p>
                  </div>

                  <div className="mt-2 flex flex-wrap justify-between gap-x-4 gap-y-1 text-xs text-slate-600">
                    <span>
                      Invoice value:{" "}
                      {formatMoney(row.invoice_total_paise, currencyCode)}
                    </span>

                    <span>
                      Outstanding:{" "}
                      {formatMoney(row.outstanding_paise, currencyCode)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-4 rounded-xl border border-slate-100 px-4 py-3">
            <p className="text-xs text-slate-500">
              Total outstanding across these invoices
            </p>

            <p className="mt-1 text-lg font-bold text-slate-900">
              {formatMoney(totalOutstandingPaise, currencyCode)}
            </p>
          </div>
        </>
      )}

      <p className="mt-5 text-xs leading-5 text-slate-500">
        As of {asOfDate}. This is a current invoice-status breakdown,
        independent of the selected reporting period.
      </p>
    </section>
  );
}
