import { useEffect, useState } from "react";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  getAnalyticsOverview,
  type AnalyticsOverview,
} from "../services/analyticsApi";
import ReceivablesAgingChart from "./ReceivablesAgingChart";
import InvoiceCollectionStatusChart from "./InvoiceCollectionStatusChart";
import TopCustomersChart from "./TopCustomersChart";
import CollectionsByMethodChart from "./CollectionsByMethodChart";

type DateRange = {
  startDate: string;
  endDate: string;
};

function localDateString(date: Date): string {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function currentMonthRange(): DateRange {
  const today = new Date();

  return {
    startDate: localDateString(
      new Date(today.getFullYear(), today.getMonth(), 1),
    ),
    endDate: localDateString(today),
  };
}

function lastTwelveMonthsRange(): DateRange {
  const today = new Date();

  return {
    startDate: localDateString(
      new Date(today.getFullYear(), today.getMonth() - 11, 1),
    ),
    endDate: localDateString(today),
  };
}

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

function formatMonth(value: string): string {
  const [year, month] = value.split("-").map(Number);

  return new Intl.DateTimeFormat("en-IN", {
    month: "short",
    year: "2-digit",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, 1)));
}

function formatDayTick(value: string): string {
  const [year, month, day] = value.split("-").map(Number);

  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

function formatFullDay(value: string): string {
  const [year, month, day] = value.split("-").map(Number);

  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

function MetricCard({
  label,
  value,
  detail,
  accent,
}: {
  label: string;
  value: string;
  detail: string;
  accent: string;
}) {
  return (
    <article className="relative min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div
        className={`absolute inset-x-0 top-0 h-1 ${accent}`}
        aria-hidden="true"
      />

      <p className="text-sm font-medium text-slate-500">{label}</p>

      <p className="mt-3 break-words text-2xl font-bold tracking-tight text-slate-900">
        {value}
      </p>

      <p className="mt-2 text-xs leading-5 text-slate-500">{detail}</p>
    </article>
  );
}

export default function BusinessAnalyticsOverview({
  showTopCustomers = false,
}: {
  showTopCustomers?: boolean;
}) {
  const [draftRange, setDraftRange] = useState<DateRange>(currentMonthRange);

  const [appliedRange, setAppliedRange] =
    useState<DateRange>(currentMonthRange);

  const [data, setData] = useState<AnalyticsOverview | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [filterError, setFilterError] = useState("");
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function loadAnalytics() {
      setIsLoading(true);
      setError("");

      try {
        const result = await getAnalyticsOverview(
          appliedRange.startDate,
          appliedRange.endDate,
        );

        if (!cancelled) {
          setData(result);
        }
      } catch {
        if (!cancelled) {
          setData(null);
          setError("Unable to load business analytics. Please try again.");
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadAnalytics();

    return () => {
      cancelled = true;
    };
  }, [appliedRange, retryKey]);

  function applyRange(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (
      !draftRange.startDate ||
      !draftRange.endDate ||
      draftRange.startDate > draftRange.endDate
    ) {
      setFilterError("Select a valid start and end date.");
      return;
    }

    const start = new Date(`${draftRange.startDate}T00:00:00Z`);
    const end = new Date(`${draftRange.endDate}T00:00:00Z`);

    if (
      Number.isNaN(start.getTime()) ||
      Number.isNaN(end.getTime()) ||
      (end.getTime() - start.getTime()) / 86_400_000 > 731
    ) {
      setFilterError("Select a period of no more than 731 days.");
      return;
    }

    setFilterError("");
    setAppliedRange({ ...draftRange });
  }

  function selectPreset(preset: "month" | "year") {
    const range =
      preset === "month" ? currentMonthRange() : lastTwelveMonthsRange();

    setDraftRange(range);
    setAppliedRange(range);
    setFilterError("");
  }

  const currencyCode = data?.filters.currency_code ?? "INR";

  const useDailyTrend = (data?.daily_trend.length ?? 0) > 0;

  const chartData = useDailyTrend
    ? (data?.daily_trend ?? []).map((day) => ({
        period: day.date,
        sales: day.taxable_sales_paise / 100,
        collections: day.recorded_receipts_paise / 100,
      }))
    : (data?.monthly_trend ?? []).map((month) => ({
        period: month.month,
        sales: month.taxable_sales_paise / 100,
        collections: month.recorded_receipts_paise / 100,
      }));

  const hasActivity = chartData.some(
    (month) => month.sales !== 0 || month.collections !== 0,
  );

  return (
    <section className="space-y-5" aria-label="Business analytics">
      <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div>
          <h3 className="text-lg font-bold text-slate-900">
            Business performance
          </h3>

          <p className="mt-1 text-sm text-slate-500">
            Explore invoiced sales, recorded collections, and current
            receivables.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => selectPreset("month")}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            This month
          </button>

          <button
            type="button"
            onClick={() => selectPreset("year")}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            Last 12 months
          </button>
        </div>

        <form onSubmit={applyRange} className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
            Start date
            <input
              type="date"
              value={draftRange.startDate}
              onChange={(event) =>
                setDraftRange((current) => ({
                  ...current,
                  startDate: event.target.value,
                }))
              }
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900"
            />
          </label>

          <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
            End date
            <input
              type="date"
              value={draftRange.endDate}
              onChange={(event) =>
                setDraftRange((current) => ({
                  ...current,
                  endDate: event.target.value,
                }))
              }
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900"
            />
          </label>

          <button
            type="submit"
            disabled={isLoading}
            className="rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Apply
          </button>
        </form>

        {filterError && (
          <p role="alert" className="text-sm text-red-600">
            {filterError}
          </p>
        )}
      </div>

      {isLoading ? (
        <div
          role="status"
          className="rounded-2xl border border-slate-200 bg-white p-8 text-sm text-slate-500 shadow-sm"
        >
          Loading business analytics…
        </div>
      ) : error || !data ? (
        <div
          role="alert"
          className="rounded-2xl border border-red-200 bg-red-50 p-6"
        >
          <p className="text-sm text-red-700">
            {error || "Business analytics is unavailable."}
          </p>

          <button
            type="button"
            onClick={() => setRetryKey((current) => current + 1)}
            className="mt-3 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
          >
            Try again
          </button>
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              label="Sales excluding tax"
              value={formatMoney(
                data.period_metrics.taxable_sales_paise,
                currencyCode,
              )}
              detail={`${data.period_metrics.invoice_count} issued tax invoices in the selected period`}
              accent="bg-indigo-500"
            />

            <MetricCard
              label="Recorded collections"
              value={formatMoney(
                data.period_metrics.recorded_receipts_paise,
                currencyCode,
              )}
              detail="Currently valid receipts dated in the selected period"
              accent="bg-emerald-500"
            />

            <MetricCard
              label="Current outstanding"
              value={formatMoney(
                data.current_balances.outstanding_paise,
                currencyCode,
              )}
              detail={`Unpaid balance across all issued invoices, as of ${data.current_balances.as_of_date}`}
              accent="bg-amber-500"
            />

            <MetricCard
              label="Current overdue"
              value={formatMoney(
                data.current_balances.overdue_paise,
                currencyCode,
              )}
              detail="Unpaid balances past their recorded due dates"
              accent="bg-rose-500"
            />
          </div>

          <section className="min-w-0 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-6">
              <h3 className="text-lg font-bold text-slate-900">
                {useDailyTrend
                  ? "Daily sales and collections"
                  : "Monthly sales and collections"}
              </h3>

              <p className="mt-1 text-sm text-slate-500">
                Sales exclude invoice tax. Collections follow receipt payment
                dates. Currency: {currencyCode}.
              </p>
            </div>

            {!hasActivity ? (
              <div className="flex h-64 items-center justify-center rounded-xl bg-slate-50 px-6 text-center text-sm text-slate-500">
                No issued sales or recorded collections were found for this
                period.
              </div>
            ) : (
              <div className="h-80 w-full min-w-0">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart
                    data={chartData}
                    margin={{
                      top: 10,
                      right: 12,
                      bottom: 5,
                      left: 0,
                    }}
                  >
                    <defs>
                      <linearGradient
                        id="taxlumeSalesGradient"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop
                          offset="0%"
                          stopColor="#6366f1"
                          stopOpacity={0.22}
                        />
                        <stop
                          offset="100%"
                          stopColor="#6366f1"
                          stopOpacity={0}
                        />
                      </linearGradient>
                    </defs>

                    <CartesianGrid
                      stroke="#e2e8f0"
                      strokeDasharray="3 3"
                      vertical={false}
                    />

                    <XAxis
                      dataKey="period"
                      tickFormatter={(value: string) =>
                        useDailyTrend
                          ? formatDayTick(value)
                          : formatMonth(value)
                      }
                      interval="preserveStartEnd"
                      minTickGap={24}
                      tickMargin={10}
                      tick={{ fontSize: 11, fill: "#64748b" }}
                      axisLine={false}
                      tickLine={false}
                    />

                    <YAxis
                      width={76}
                      tickFormatter={(value: number) =>
                        formatCompactMoney(value, currencyCode)
                      }
                      tick={{ fontSize: 11, fill: "#64748b" }}
                      axisLine={false}
                      tickLine={false}
                    />

                    <Tooltip
                      labelFormatter={(label) =>
                        useDailyTrend
                          ? formatFullDay(String(label))
                          : formatMonth(String(label))
                      }
                      formatter={(value, name) => [
                        formatMoney(Number(value ?? 0) * 100, currencyCode),
                        String(name),
                      ]}
                    />

                    <Area
                      type="monotone"
                      dataKey="sales"
                      name="Sales excluding tax"
                      stroke="#4f46e5"
                      strokeWidth={2.5}
                      fill="url(#taxlumeSalesGradient)"
                      dot={false}
                      activeDot={{ r: 5 }}
                    />

                    <Line
                      type="monotone"
                      dataKey="collections"
                      name="Recorded collections"
                      stroke="#059669"
                      strokeWidth={2.5}
                      dot={false}
                      activeDot={{ r: 5 }}
                    />
                  </ComposedChart>
                </ResponsiveContainer>

                <div className="mt-2 flex flex-wrap justify-center gap-5 text-xs font-medium text-slate-600">
                  <span>
                    <span className="mr-2 inline-block h-2.5 w-2.5 rounded-full bg-indigo-600" />
                    Sales excluding tax
                  </span>

                  <span>
                    <span className="mr-2 inline-block h-2.5 w-2.5 rounded-full bg-emerald-600" />
                    Recorded collections
                  </span>
                </div>
              </div>
            )}

            <p className="mt-10 text-xs leading-5 text-slate-500">
              Historical collections may exclude payments entered before Taxlume
              introduced receipt tracking. Outstanding and overdue figures are
              current balances, not balances from the selected reporting period.
            </p>
          </section>

          {showTopCustomers && (
            <div className="grid items-start gap-5">
              <TopCustomersChart
                customers={data.top_customers}
                currencyCode={currencyCode}
                periodSalesPaise={data.period_metrics.taxable_sales_paise}
              />

              <CollectionsByMethodChart
                methods={data.collections_by_method}
                currencyCode={currencyCode}
                periodCollectionsPaise={
                  data.period_metrics.recorded_receipts_paise
                }
              />
            </div>
          )}

          <div className="grid items-start gap-5 xl:grid-cols-2">
            <ReceivablesAgingChart
              aging={data.receivables_aging}
              currencyCode={currencyCode}
              asOfDate={data.current_balances.as_of_date}
            />

            <InvoiceCollectionStatusChart
              statuses={data.collection_status}
              currencyCode={currencyCode}
              asOfDate={data.current_balances.as_of_date}
            />
          </div>
        </>
      )}
    </section>
  );
}
