import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { AnalyticsTopCustomer } from "../services/analyticsApi";
import { chartColors } from "../theme/brandColors";

type Props = {
  customers: AnalyticsTopCustomer[];
  currencyCode: string;
  periodSalesPaise: number;
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

export default function TopCustomersChart({
  customers,
  currencyCode,
  periodSalesPaise,
}: Props) {
  const chartData = customers.map((customer, index) => ({
    ...customer,
    axis_label: `${index + 1}. ${customer.customer_name}`,
    sales_amount: customer.taxable_sales_paise / 100,
  }));

  const displayedSalesPaise = customers.reduce(
    (total, customer) => total + customer.taxable_sales_paise,
    0,
  );

  return (
    <section className="min-w-0 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div>
        <h3 className="text-lg font-bold text-slate-900">
          Top customers by sales
        </h3>

        <p className="mt-1 text-sm leading-6 text-slate-500">
          Up to eight customer groups ranked by issued tax-invoice sales,
          excluding tax, in the selected period.
        </p>
      </div>

      {customers.length === 0 ? (
        <div className="mt-6 flex min-h-48 items-center justify-center rounded-xl bg-slate-50 px-5 text-center text-sm text-slate-500">
          No issued tax invoices were found for this period.
        </div>
      ) : (
        <>
          <div
            className="mt-6 w-full min-w-0"
            style={{
              height: Math.max(190, customers.length * 55 + 65),
            }}
          >
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
                barCategoryGap="30%"
              >
                <CartesianGrid
                  stroke={chartColors.grid}
                  strokeDasharray="3 3"
                  horizontal={false}
                />

                <XAxis
                  type="number"
                  domain={[0, "auto"]}
                  tickFormatter={(value: number) =>
                    formatCompactMoney(value, currencyCode)
                  }
                  tick={{ fontSize: 11, fill: chartColors.axis }}
                  axisLine={false}
                  tickLine={false}
                />

                <YAxis
                  type="category"
                  dataKey="axis_label"
                  width={135}
                  interval={0}
                  tickFormatter={(value: string) =>
                    value.length > 22 ? `${value.slice(0, 21)}…` : value
                  }
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
                  dataKey="sales_amount"
                  name="Sales excluding tax"
                  fill={chartColors.sales}
                  radius={[0, 6, 6, 0]}
                  maxBarSize={26}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="mt-5 space-y-2">
            {customers.map((customer, index) => (
              <div
                key={customer.party_id ?? "unassigned"}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-100 bg-slate-50 px-3 py-3"
              >
                <div className="min-w-0">
                  <p className="break-words text-sm font-semibold text-slate-800">
                    {index + 1}. {customer.customer_name}
                  </p>

                  <p className="mt-1 text-xs text-slate-500">
                    {customer.invoice_count}{" "}
                    {customer.invoice_count === 1 ? "invoice" : "invoices"}
                  </p>
                </div>

                <p className="text-sm font-semibold text-slate-900">
                  {formatMoney(customer.taxable_sales_paise, currencyCode)}
                </p>
              </div>
            ))}
          </div>

          <div className="mt-4 rounded-xl border border-slate-100 px-4 py-3">
            <p className="text-xs text-slate-500">
              Sales represented by the customer groups shown
            </p>

            <p className="mt-1 text-lg font-bold text-slate-900">
              {formatMoney(displayedSalesPaise, currencyCode)}
            </p>

            <p className="mt-1 text-xs text-slate-500">
              Selected-period sales across all customers:{" "}
              {formatMoney(periodSalesPaise, currencyCode)}
            </p>
          </div>
        </>
      )}

      <p className="mt-5 text-xs leading-5 text-slate-500">
        Customer names reflect their current records. An invoice without an
        assigned customer appears under “Unassigned customer.” Other customer
        groups may be omitted when more than eight exist.
      </p>
    </section>
  );
}
