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

import type { AnalyticsPaymentMethod } from "../services/analyticsApi";

type Props = {
  methods: AnalyticsPaymentMethod[];
  currencyCode: string;
  periodCollectionsPaise: number;
};

const METHOD_COLORS: Record<string, string> = {
  UPI: "#6366f1",
  BANK_TRANSFER: "#0891b2",
  CASH: "#10b981",
  CARD: "#f59e0b",
  CHEQUE: "#8b5cf6",
  OTHER: "#64748b",
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

export default function CollectionsByMethodChart({
  methods,
  currencyCode,
  periodCollectionsPaise,
}: Props) {
  const totalReceipts = methods.reduce(
    (total, method) => total + method.receipt_count,
    0,
  );

  const totalCollectionsPaise = methods.reduce(
    (total, method) => total + method.amount_paise,
    0,
  );

  const chartData = methods.map((method) => ({
    ...method,
    amount: method.amount_paise / 100,
  }));

  return (
    <section className="min-w-0 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h3 className="text-lg font-bold text-slate-900">
            Collections by payment method
          </h3>

          <p className="mt-1 text-sm leading-6 text-slate-500">
            Currently valid invoice receipts dated within the selected reporting
            period.
          </p>
        </div>

        <div className="rounded-xl bg-slate-50 px-4 py-3">
          <p className="text-xs font-medium text-slate-500">
            Total recorded collections
          </p>

          <p className="mt-1 text-xl font-bold text-slate-900">
            {formatMoney(totalCollectionsPaise, currencyCode)}
          </p>

          <p className="mt-1 text-xs text-slate-500">
            {totalReceipts} {totalReceipts === 1 ? "receipt" : "receipts"}
          </p>
        </div>
      </div>

      {totalCollectionsPaise === 0 ? (
        <div className="mt-6 flex min-h-48 items-center justify-center rounded-xl bg-slate-50 px-5 text-center text-sm text-slate-500">
          No active recorded receipts were found for this period.
        </div>
      ) : (
        <>
          <div className="mt-6 h-[310px] w-full min-w-0">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={chartData}
                layout="vertical"
                margin={{
                  top: 5,
                  right: 15,
                  bottom: 5,
                  left: 0,
                }}
                barCategoryGap="28%"
              >
                <CartesianGrid
                  stroke="#e2e8f0"
                  strokeDasharray="3 3"
                  horizontal={false}
                />

                <XAxis
                  type="number"
                  domain={[0, "auto"]}
                  tickFormatter={(value: number) =>
                    formatCompactMoney(value, currencyCode)
                  }
                  tick={{ fontSize: 11, fill: "#64748b" }}
                  axisLine={false}
                  tickLine={false}
                />

                <YAxis
                  type="category"
                  dataKey="label"
                  width={105}
                  interval={0}
                  tick={{ fontSize: 11, fill: "#64748b" }}
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
                  dataKey="amount"
                  name="Recorded collections"
                  radius={[0, 6, 6, 0]}
                  maxBarSize={25}
                >
                  {chartData.map((method) => (
                    <Cell
                      key={method.payment_method}
                      fill={
                        METHOD_COLORS[method.payment_method] ??
                        METHOD_COLORS.OTHER
                      }
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="mt-5 grid gap-2 sm:grid-cols-2">
            {methods.map((method) => (
              <div
                key={method.payment_method}
                className="flex min-w-0 items-center justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50 px-3 py-3"
              >
                <div className="flex min-w-0 items-center gap-2">
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{
                      backgroundColor:
                        METHOD_COLORS[method.payment_method] ??
                        METHOD_COLORS.OTHER,
                    }}
                    aria-hidden="true"
                  />

                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-800">
                      {method.label}
                    </p>

                    <p className="mt-0.5 text-xs text-slate-500">
                      {method.receipt_count}{" "}
                      {method.receipt_count === 1 ? "receipt" : "receipts"}
                    </p>
                  </div>
                </div>

                <p className="shrink-0 text-sm font-semibold text-slate-900">
                  {formatMoney(method.amount_paise, currencyCode)}
                </p>
              </div>
            ))}
          </div>

          <p className="mt-4 text-xs leading-5 text-slate-500">
            The method totals represent recorded receipts in Techabanca Billing, not
            bank-verified transactions. Reversed receipts are excluded.
          </p>
        </>
      )}

      {totalCollectionsPaise !== periodCollectionsPaise && (
        <p
          role="alert"
          className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-800"
        >
          Payment-method totals do not match the recorded collections summary.
          Please refresh the report.
        </p>
      )}
    </section>
  );
}
