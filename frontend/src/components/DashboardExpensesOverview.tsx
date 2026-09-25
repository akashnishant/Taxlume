import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight, CalendarClock, ReceiptText } from "lucide-react";
import LoadingState from "./LoadingState";
import { getExpenseReport, type ExpenseReport } from "../services/expenseReportApi";
import { getApiErrorMessage } from "../utils/apiErrorMessage";

type Props = {
  currencyCode: string;
  startDate: string;
  endDate: string;
};

type OverviewData = {
  recordedPaise: number;
  scheduledPaise: number;
  scheduledOccurrenceCount: number;
  hasOtherCurrencies: boolean;
};


function formatMoney(amountPaise: number, currencyCode: string): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: currencyCode,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amountPaise / 100);
}

function formatDate(value: string): string {
  const [year, month, day] = value.split("-").map(Number);

  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

function hasOtherCurrencies(
  report: ExpenseReport,
  currencyCode: string,
): boolean {
  return (
    report.currencies.some(
      (item) =>
        item.currency_code !== currencyCode &&
        item.expense_count > 0,
    ) ||
    report.scheduled_currencies.some(
      (item) =>
        item.currency_code !== currencyCode &&
        item.occurrence_count > 0,
    )
  );
}

function MetricCard({
  label,
  value,
  description,
  accent = false,
}: {
  label: string;
  value: string;
  description: string;
  accent?: boolean;
}) {
  return (
    <article
      className={
        accent
          ? "rounded-xl border border-lime-300 bg-lime-50 p-5"
          : "rounded-xl border border-slate-200 bg-white p-5"
      }
    >
      <p className="text-sm font-medium text-slate-600">{label}</p>

      <p className="mt-2 break-words text-2xl font-bold text-slate-950">
        {value}
      </p>

      <p className="mt-2 text-xs leading-5 text-slate-600">
        {description}
      </p>
    </article>
  );
}

export default function DashboardExpensesOverview({
  currencyCode,
  startDate,
  endDate,
}: Props) {
  const [data, setData] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function loadOverview() {
      setLoading(true);
      setError("");
      setData(null);

      try {
        const report = await getExpenseReport({
          start_date: startDate,
          end_date: endDate,
          granularity: "month",
        });

        if (cancelled) return;

        const recorded = report.currencies.find(
          (item) => item.currency_code === currencyCode,
        );

        const scheduled = report.scheduled_currencies.find(
          (item) => item.currency_code === currencyCode,
        );

        setData({
          recordedPaise: recorded?.total_paise ?? 0,
          scheduledPaise: scheduled?.scheduled_paise ?? 0,
          scheduledOccurrenceCount: scheduled?.occurrence_count ?? 0,
          hasOtherCurrencies: hasOtherCurrencies(report, currencyCode),
        });
      } catch (requestError) {
        if (!cancelled) {
          setError(
            getApiErrorMessage(
              requestError,
              "Unable to load the expense overview.",
            ),
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadOverview();

    return () => {
      cancelled = true;
    };
  }, [currencyCode, startDate, endDate, retryKey]);

  const projectedPaise = data
    ? data.recordedPaise + data.scheduledPaise
    : 0;

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <ReceiptText size={21} className="text-emerald-700" />
            <h3 className="text-lg font-bold text-slate-900">
              Expenses overview
            </h3>
          </div>

          <p className="mt-1 text-sm text-slate-600">
            Recorded expenses and upcoming recurring commitments.
          </p>
        </div>

        <Link
          to="/expenses/reports"
          className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-lime-400 hover:bg-lime-50"
        >
          View expense reports
          <ArrowUpRight size={16} />
        </Link>
      </div>

      {loading ? (
        <div className="py-8">
          <LoadingState
            message="Loading expense overview..."
            description="Retrieving recorded and upcoming expenses."
          />
        </div>
      ) : error ? (
        <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4">
          <p role="alert" className="text-sm text-amber-900">
            {error}
          </p>
          <button
            type="button"
            onClick={() => setRetryKey((current) => current + 1)}
            className="mt-3 rounded-lg bg-lime-300 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-lime-200"
          >
            Try again
          </button>
        </div>
      ) : data ? (
        <>
          <p className="mt-4 text-xs font-medium text-slate-600">
            Selected period: {formatDate(startDate)} – {formatDate(endDate)}
          </p>

          <div className="mt-4 grid gap-4 md:grid-cols-3">
            <MetricCard
              label="Recorded expenses"
              value={formatMoney(data.recordedPaise, currencyCode)}
              description="Actual expenses dated within the selected period"
            />

            <MetricCard
              label="Upcoming scheduled"
              value={formatMoney(data.scheduledPaise, currencyCode)}
              description={`${data.scheduledOccurrenceCount.toLocaleString("en-IN")} not-yet-generated recurring ${
                data.scheduledOccurrenceCount === 1
                  ? "occurrence"
                  : "occurrences"
              } within the selected period`}
            />

            <MetricCard
              label="Projected total"
              value={formatMoney(projectedPaise, currencyCode)}
              description="Recorded plus upcoming scheduled expenses for the selected period"
              accent
            />
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-slate-600">
            <CalendarClock size={15} />
            <span>
              Scheduled amounts include future occurrences only,
              within the selected dates. Past expenses are not projected again.
            </span>
          </div>

          {data.hasOtherCurrencies && (
            <p className="mt-3 text-xs text-amber-800">
              Figures above use {currencyCode} only. Open Expense
              Reports to view expenses in other currencies separately.
            </p>
          )}
        </>
      ) : null}
    </section>
  );
}