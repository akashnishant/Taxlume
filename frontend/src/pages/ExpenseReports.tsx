import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import LoadingState from "../components/LoadingState";
import ExpenseReportCharts from "../components/ExpenseReportCharts";
import {
  getExpenseReport,
  type ExpenseReport,
  type ExpenseReportCurrency,
  type ExpenseReportGranularity,
  type ExpenseReportParams,
  type ScheduledExpenseReportCurrency,
} from "../services/expenseReportApi";
import { getApiErrorMessage } from "../utils/apiErrorMessage";

type DateRange = {
  startDate: string;
  endDate: string;
};

const inputClass =
  "mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100";

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

function upcomingThirtyDaysRange(): DateRange {
  const today = new Date();

  return {
    startDate: localDateString(today),
    endDate: localDateString(
      new Date(
        today.getFullYear(),
        today.getMonth(),
        today.getDate() + 29,
      ),
    ),
  };
}

function parseCalendarDate(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;

  const date = new Date(`${value}T00:00:00.000Z`);

  if (
    Number.isNaN(date.getTime()) ||
    date.toISOString().slice(0, 10) !== value
  ) {
    return null;
  }

  return date;
}

function validateRange(
  range: DateRange,
  granularity: ExpenseReportGranularity,
): string {
  const start = parseCalendarDate(range.startDate);
  const end = parseCalendarDate(range.endDate);

  if (!start || !end) {
    return "Select a valid start and end date.";
  }

  if (start > end) {
    return "Start date must not be after end date.";
  }

  const days = (end.getTime() - start.getTime()) / 86400000;
  const maximumDays = granularity === "day" ? 731 : 3653;

  if (days > maximumDays) {
    return granularity === "day"
      ? "Daily reports support a maximum date range of 731 days."
      : "Monthly and annual reports support a maximum date range of 3653 days.";
  }

  return "";
}

function formatAmount(amountPaise: number, currencyCode: string): string {
  const amount = (amountPaise / 100).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  return `${currencyCode} ${amount}`;
}

function formatPeriod(
  period: string,
  granularity: ExpenseReportGranularity,
): string {
  if (granularity === "year") return period;

  const [year, month, day] = period.split("-").map(Number);

  if (granularity === "month") {
    return new Intl.DateTimeFormat("en-IN", {
      month: "short",
      year: "numeric",
      timeZone: "UTC",
    }).format(new Date(Date.UTC(year, month - 1, 1)));
  }

  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

function formatDate(value: string): string {
  return formatPeriod(value, "day");
}

function SummaryCard({
  label,
  value,
  supportingText,
}: {
  label: string;
  value: string;
  supportingText?: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <p className="text-sm font-medium text-slate-600">{label}</p>
      <p className="mt-2 break-words text-2xl font-bold text-slate-900">
        {value}
      </p>
      {supportingText && (
        <p className="mt-1 text-xs text-slate-500">{supportingText}</p>
      )}
    </div>
  );
}

function CurrencyReportSection({
  report,
  scheduled,
  granularity,
}: {
  report: ExpenseReportCurrency;
  scheduled?: ScheduledExpenseReportCurrency;
  granularity: ExpenseReportGranularity;
}) {
  const money = (amountPaise: number) =>
    formatAmount(amountPaise, report.currency_code);

  const scheduledPaise = scheduled?.scheduled_paise ?? 0;
  const scheduledCount = scheduled?.occurrence_count ?? 0;
  const projectedPaise = report.total_paise + scheduledPaise;

  const periodTitle =
    granularity === "day"
      ? "Daily totals"
      : granularity === "month"
        ? "Monthly totals"
        : "Annual totals";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-bold text-slate-900">
          {report.currency_code} expense summary
        </h2>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
          {report.expense_count.toLocaleString("en-IN")} recorded{" "}
          {report.expense_count === 1 ? "expense" : "expenses"}
        </span>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          label="Recorded expenses"
          value={money(report.total_paise)}
          supportingText="Actual expenses recorded in this date range"
        />
        <SummaryCard
          label="Upcoming scheduled"
          value={money(scheduledPaise)}
          supportingText="Future recurring occurrences not yet generated"
        />
        <div className="rounded-xl border border-lime-300 bg-lime-50 p-5">
          <p className="text-sm font-semibold text-slate-700">
            Projected total
          </p>
          <p className="mt-2 break-words text-2xl font-bold text-slate-950">
            {money(projectedPaise)}
          </p>
          <p className="mt-1 text-xs text-slate-600">
            Recorded plus upcoming scheduled expenses
          </p>
        </div>
        <SummaryCard
          label="Recorded entries"
          value={report.expense_count.toLocaleString("en-IN")}
          supportingText="Excludes deleted records"
        />
        <SummaryCard
          label="Manual recorded"
          value={money(report.manual_paise)}
          supportingText="Expenses entered manually"
        />
        <SummaryCard
          label="Generated recurring"
          value={money(report.recurring_paise)}
          supportingText="Recurring expenses already generated"
        />
        <SummaryCard
          label="Scheduled occurrences"
          value={scheduledCount.toLocaleString("en-IN")}
          supportingText="Upcoming occurrences not yet generated"
        />
      </div>

      <ExpenseReportCharts
        recorded={report}
        scheduled={scheduled}
        granularity={granularity}
      />

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-5 py-4">
          <h3 className="text-base font-bold text-slate-900">
            Recorded {periodTitle.toLowerCase()}
          </h3>
          <p className="mt-1 text-sm text-slate-600">
            Actual expense totals, separated by source.
          </p>
        </div>

        {report.periods.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-slate-500">
            No expenses were recorded in the selected date range.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-600">
                <tr>
                  <th scope="col" className="px-5 py-3 font-semibold">
                    Period
                  </th>
                  <th scope="col" className="px-5 py-3 text-right font-semibold">
                    Entries
                  </th>
                  <th scope="col" className="px-5 py-3 text-right font-semibold">
                    Manual
                  </th>
                  <th scope="col" className="px-5 py-3 text-right font-semibold">
                    Recurring
                  </th>
                  <th scope="col" className="px-5 py-3 text-right font-semibold">
                    Total
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {report.periods.map((period) => (
                  <tr key={`${period.currency_code}-${period.period}`}>
                    <th
                      scope="row"
                      className="whitespace-nowrap px-5 py-4 font-semibold text-slate-900"
                    >
                      {formatPeriod(period.period, granularity)}
                    </th>
                    <td className="px-5 py-4 text-right text-slate-600">
                      {period.expense_count.toLocaleString("en-IN")}
                    </td>
                    <td className="whitespace-nowrap px-5 py-4 text-right text-slate-700">
                      {money(period.manual_paise)}
                    </td>
                    <td className="whitespace-nowrap px-5 py-4 text-right text-slate-700">
                      {money(period.recurring_paise)}
                    </td>
                    <td className="whitespace-nowrap px-5 py-4 text-right font-semibold text-slate-900">
                      {money(period.total_paise)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-5 py-4">
          <h3 className="text-base font-bold text-slate-900">
            Upcoming scheduled {periodTitle.toLowerCase()}
          </h3>
          <p className="mt-1 text-sm text-slate-600">
            Expected recurring occurrences that have not yet
            generated expense records.
          </p>
        </div>

        {!scheduled?.periods.length ? (
          <p className="px-5 py-10 text-center text-sm text-slate-500">
            No upcoming recurring expenses in this date range.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-600">
                <tr>
                  <th scope="col" className="px-5 py-3 font-semibold">
                    Period
                  </th>
                  <th scope="col" className="px-5 py-3 text-right font-semibold">
                    Scheduled occurrences
                  </th>
                  <th scope="col" className="px-5 py-3 text-right font-semibold">
                    Scheduled amount
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {scheduled.periods.map((period) => (
                  <tr key={period.period}>
                    <th
                      scope="row"
                      className="whitespace-nowrap px-5 py-4 font-semibold text-slate-900"
                    >
                      {formatPeriod(period.period, granularity)}
                    </th>
                    <td className="px-5 py-4 text-right text-slate-600">
                      {period.occurrence_count.toLocaleString("en-IN")}
                    </td>
                    <td className="whitespace-nowrap px-5 py-4 text-right font-semibold text-slate-900">
                      {money(period.scheduled_paise)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-5 py-4">
          <h3 className="text-base font-bold text-slate-900">
            Upcoming scheduled category breakdown
          </h3>
          <p className="mt-1 text-sm text-slate-600">
            Future recurring amounts grouped by their assigned categories.
          </p>
        </div>

        {!scheduled?.categories.length ? (
          <p className="px-5 py-10 text-center text-sm text-slate-500">
            No upcoming scheduled category data for this date range.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-600">
                <tr>
                  <th scope="col" className="px-5 py-3 font-semibold">
                    Category
                  </th>
                  <th scope="col" className="px-5 py-3 text-right font-semibold">
                    Scheduled occurrences
                  </th>
                  <th scope="col" className="px-5 py-3 text-right font-semibold">
                    Scheduled amount
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {scheduled.categories.map((category) => (
                  <tr key={category.category_id}>
                    <th
                      scope="row"
                      className="px-5 py-4 font-semibold text-slate-900"
                    >
                      {category.parent_category_name && (
                        <span className="block text-xs font-normal text-slate-500">
                          {category.parent_category_name}
                        </span>
                      )}
                      {category.category_name}
                    </th>
                    <td className="px-5 py-4 text-right text-slate-600">
                      {category.occurrence_count.toLocaleString("en-IN")}
                    </td>
                    <td className="whitespace-nowrap px-5 py-4 text-right font-semibold text-slate-900">
                      {money(category.scheduled_paise)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-5 py-4">
          <h3 className="text-base font-bold text-slate-900">
            Recorded category breakdown
          </h3>
          <p className="mt-1 text-sm text-slate-600">
            Totals by recorded expense category, including subcategories.
          </p>
        </div>

        {report.categories.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-slate-500">
            No category data for the selected date range.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-600">
                <tr>
                  <th scope="col" className="px-5 py-3 font-semibold">
                    Category
                  </th>
                  <th scope="col" className="px-5 py-3 text-right font-semibold">
                    Entries
                  </th>
                  <th scope="col" className="px-5 py-3 text-right font-semibold">
                    Manual
                  </th>
                  <th scope="col" className="px-5 py-3 text-right font-semibold">
                    Recurring
                  </th>
                  <th scope="col" className="px-5 py-3 text-right font-semibold">
                    Total
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {report.categories.map((category) => (
                  <tr key={category.category_id}>
                    <th
                      scope="row"
                      className="px-5 py-4 font-semibold text-slate-900"
                    >
                      {category.parent_category_name ? (
                        <>
                          <span className="block text-xs font-normal text-slate-500">
                            {category.parent_category_name}
                          </span>
                          {category.category_name}
                        </>
                      ) : (
                        category.category_name
                      )}
                    </th>
                    <td className="px-5 py-4 text-right text-slate-600">
                      {category.expense_count.toLocaleString("en-IN")}
                    </td>
                    <td className="whitespace-nowrap px-5 py-4 text-right text-slate-700">
                      {money(category.manual_paise)}
                    </td>
                    <td className="whitespace-nowrap px-5 py-4 text-right text-slate-700">
                      {money(category.recurring_paise)}
                    </td>
                    <td className="whitespace-nowrap px-5 py-4 text-right font-semibold text-slate-900">
                      {money(category.total_paise)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

export default function ExpenseReports() {
  const [draftRange, setDraftRange] = useState<DateRange>(currentMonthRange);
  const [draftGranularity, setDraftGranularity] =
    useState<ExpenseReportGranularity>("day");

  const [appliedParams, setAppliedParams] = useState<ExpenseReportParams>(() => {
    const range = currentMonthRange();

    return {
      start_date: range.startDate,
      end_date: range.endDate,
      granularity: "day",
    };
  });

  const [report, setReport] = useState<ExpenseReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filterError, setFilterError] = useState("");
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    let cancelled = false;

    setLoading(true);
    setError("");
    setReport(null);

    getExpenseReport(appliedParams)
      .then((result) => {
        if (!cancelled) setReport(result);
      })
      .catch((requestError: unknown) => {
        if (cancelled) return;

        setError(
          getApiErrorMessage(
            requestError,
            "Unable to load the expense report.",
          ),
        );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [appliedParams, retryKey]);

  function applyFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const validationError = validateRange(
      draftRange,
      draftGranularity,
    );

    if (validationError) {
      setFilterError(validationError);
      return;
    }

    setFilterError("");

    const nextParams: ExpenseReportParams = {
      start_date: draftRange.startDate,
      end_date: draftRange.endDate,
      granularity: draftGranularity,
    };

    if (
      appliedParams.start_date === nextParams.start_date &&
      appliedParams.end_date === nextParams.end_date &&
      appliedParams.granularity === nextParams.granularity
    ) {
      setRetryKey((current) => current + 1);
    } else {
      setAppliedParams(nextParams);
    }
  }

  function applyPreset(range: DateRange) {
    setDraftRange(range);
    setDraftGranularity("day");
    setFilterError("");

    setAppliedParams({
      start_date: range.startDate,
      end_date: range.endDate,
      granularity: "day",
    });
  }

  return (
    <main className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 sm:py-8">
      <header>
        <h1 className="text-2xl font-bold text-slate-900">Expenses</h1>
        <p className="mt-1 text-sm text-slate-600">
          View business expenses recorded manually or generated from recurring rules.
        </p>
      </header>

      <nav
        aria-label="Expenses sections"
        className="flex flex-wrap gap-2 border-b border-slate-200"
      >
        <Link
          to="/expenses"
          className="px-4 py-3 text-sm font-medium text-slate-600 hover:text-slate-900"
        >
          All expenses
        </Link>
        <Link
          to="/expenses/recurring"
          className="px-4 py-3 text-sm font-medium text-slate-600 hover:text-slate-900"
        >
          Recurring expenses
        </Link>
        <Link
          to="/expenses/categories"
          className="px-4 py-3 text-sm font-medium text-slate-600 hover:text-slate-900"
        >
          Categories
        </Link>
        <span
          aria-current="page"
          className="border-b-2 border-emerald-600 px-4 py-3 text-sm font-semibold text-emerald-700"
        >
          Reports
        </span>
      </nav>

      <section className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
        <form onSubmit={applyFilters} className="space-y-4">
          <div
            role="group"
            aria-label="Quick date ranges"
            className="flex flex-wrap items-center gap-2"
          >
            <span className="mr-1 text-sm font-medium text-slate-600">
              Quick ranges
            </span>
            <button
              type="button"
              onClick={() => applyPreset(currentMonthRange())}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:border-lime-400 hover:bg-lime-50"
            >
              Current month
            </button>
            <button
              type="button"
              onClick={() => applyPreset(upcomingThirtyDaysRange())}
              className="rounded-lg border border-lime-400 bg-lime-50 px-3 py-2 text-sm font-semibold text-slate-900 hover:bg-lime-100"
            >
              Upcoming 30 days
            </button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1.2fr_auto] lg:items-end">
            <label className="block text-sm font-medium text-slate-700">
              Start date
              <input
                type="date"
                required
                value={draftRange.startDate}
                onChange={(event) => {
                  setDraftRange((current) => ({
                    ...current,
                    startDate: event.target.value,
                  }));
                  setFilterError("");
                }}
                className={inputClass}
              />
            </label>

            <label className="block text-sm font-medium text-slate-700">
              End date
              <input
                type="date"
                required
                value={draftRange.endDate}
                onChange={(event) => {
                  setDraftRange((current) => ({
                    ...current,
                    endDate: event.target.value,
                  }));
                  setFilterError("");
                }}
                className={inputClass}
              />
            </label>

            <label className="block text-sm font-medium text-slate-700">
              Group totals by
              <select
                value={draftGranularity}
                onChange={(event) => {
                  setDraftGranularity(
                    event.target.value as ExpenseReportGranularity,
                  );
                  setFilterError("");
                }}
                className={inputClass}
              >
                <option value="day">Daily</option>
                <option value="month">Monthly</option>
                <option value="year">Annual</option>
              </select>
            </label>

            <button
              type="submit"
              disabled={loading}
              className="rounded-lg bg-lime-300 px-4 py-2.5 text-sm font-semibold text-slate-950 hover:bg-lime-200 disabled:cursor-wait disabled:opacity-50"
            >
              {loading ? "Loading..." : "Apply filters"}
            </button>
          </div>

          {filterError && (
            <p role="alert" className="text-sm text-red-700">
              {filterError}
            </p>
          )}
        </form>
      </section>

      {loading ? (
        <section className="rounded-xl border border-slate-200 bg-white px-5 py-10">
          <LoadingState
            message="Loading expense report..."
            description="Calculating totals for your selected date range."
          />
        </section>
      ) : error ? (
        <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-6">
          <p role="alert" className="text-sm text-red-700">
            {error}
          </p>
          <button
            type="button"
            onClick={() => setRetryKey((current) => current + 1)}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Try again
          </button>
        </section>
      ) : report ? (
        <>
          <p className="text-sm text-slate-600">
            Showing expenses from{" "}
            <span className="font-semibold text-slate-800">
              {formatDate(report.start_date)}
            </span>{" "}
            to{" "}
            <span className="font-semibold text-slate-800">
              {formatDate(report.end_date)}
            </span>
            . Each currency is reported separately.
          </p>

          {Array.from(
            new Set([
              ...report.currencies.map((item) => item.currency_code),
              ...report.scheduled_currencies.map(
                (item) => item.currency_code,
              ),
            ]),
          )
            .sort()
            .map((currencyCode) => {
              const recorded = report.currencies.find(
                (item) => item.currency_code === currencyCode,
              );

              const scheduled = report.scheduled_currencies.find(
                (item) => item.currency_code === currencyCode,
              );

              const currencyReport: ExpenseReportCurrency = recorded ?? {
                currency_code: currencyCode,
                expense_count: 0,
                total_paise: 0,
                manual_paise: 0,
                recurring_paise: 0,
                periods: [],
                categories: [],
              };

              return (
                <CurrencyReportSection
                  key={currencyCode}
                  report={currencyReport}
                  scheduled={scheduled}
                  granularity={report.granularity}
                />
              );
            })}
        </>
      ) : null}
    </main>
  );
}