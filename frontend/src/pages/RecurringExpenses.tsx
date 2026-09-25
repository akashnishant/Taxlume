import { useEffect, useState, type FormEvent } from "react";
import LoadingState from "../components/LoadingState";
import { useNotification } from "../hooks/useNotifications";
import RecurringExpenseCreateModal from "../components/RecurringExpenseCreateModal";
import ConfirmDialog from "../components/ConfirmDialog";
import { getApiErrorMessage } from "../utils/apiErrorMessage";
import {
  getRecurringExpenses,
  setRecurringExpenseActive,
  deleteRecurringExpense,
  type RecurringExpenseRule,
  type RecurringExpensePagination,
  type RecurringFrequency,
} from "../services/recurringExpenseApi";

type StatusFilter = "" | "ACTIVE" | "INACTIVE";
type FrequencyFilter = "" | RecurringFrequency;

type PendingRuleAction = {
  kind: "toggle" | "delete";
  rule: RecurringExpenseRule;
};

const PAGE_SIZE = 20;

const frequencyUnits: Record<RecurringFrequency, string> = {
  DAILY: "day",
  WEEKLY: "week",
  MONTHLY: "month",
  YEARLY: "year",
};

function formatAmount(amountPaise: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amountPaise / 100);
  } catch {
    return `${currency} ${(amountPaise / 100).toFixed(2)}`;
  }
}

function formatDate(value: string | null): string {
  if (!value) return "—";

  const date = new Date(`${value}T00:00:00Z`);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

function formatFrequency(rule: RecurringExpenseRule): string {
  const unit = frequencyUnits[rule.frequency];

  if (rule.interval_count === 1) {
    return `Every ${unit}`;
  }

  return `Every ${rule.interval_count} ${unit}s`;
}

function getErrorMessage(error: unknown): string {
  if (
    error &&
    typeof error === "object" &&
    "response" in error
  ) {
    const response = (error as {
      response?: {
        data?: {
          message?: string;
        };
      };
    }).response;

    if (response?.data?.message) {
      return response.data.message;
    }
  }

  return error instanceof Error
    ? error.message
    : "Unable to load recurring expense rules.";
}

export default function RecurringExpenses() {
  const notify = useNotification();
  const [rules, setRules] = useState<RecurringExpenseRule[]>([]);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [pendingAction, setPendingAction] =
    useState<PendingRuleAction | null>(null);
  const [isProcessingAction, setIsProcessingAction] = useState(false);

  const [pagination, setPagination] =
    useState<RecurringExpensePagination | null>(null);

  const [searchDraft, setSearchDraft] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<StatusFilter>("");
  const [frequency, setFrequency] = useState<FrequencyFilter>("");
  const [page, setPage] = useState(1);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    setLoading(true);
    setError(null);

    getRecurringExpenses({
      page,
      limit: PAGE_SIZE,
      search: search || undefined,
      status: status || undefined,
      frequency: frequency || undefined,
    })
      .then((result) => {
        if (cancelled) return;

        setRules(result.recurring_expenses);
        setPagination(result.pagination);
      })
      .catch((requestError: unknown) => {
        if (cancelled) return;

        setRules([]);
        setPagination(null);
        setError(getErrorMessage(requestError));
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [page, search, status, frequency, refreshKey]);

  function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPage(1);
    setSearch(searchDraft.trim());
  }

  async function confirmRuleAction() {
    if (!pendingAction || isProcessingAction) return;

    const { kind, rule } = pendingAction;
    const wasActive = rule.is_active === 1;

    setIsProcessingAction(true);

    try {
      if (kind === "delete") {
        await deleteRecurringExpense(rule.id);
      } else {
        await setRecurringExpenseActive(rule.id, !wasActive);
      }

      notify({
        type: "success",
        title:
          kind === "delete"
            ? "Recurring expense deleted"
            : wasActive
              ? "Recurring expense paused"
              : "Recurring expense resumed",
        description:
          kind === "delete"
            ? `"${rule.name}" has been removed from recurring rules. Previously generated expenses are unchanged.`
            : wasActive
              ? `"${rule.name}" will not generate future expenses while paused.`
              : `"${rule.name}" is active again.`,
      });

      setPendingAction(null);
      setRefreshKey((current) => current + 1);
    } catch (error) {
      notify({
        type: "error",
        title:
          kind === "delete"
            ? "Unable to delete recurring expense"
            : "Unable to change recurring expense status",
        description: getApiErrorMessage(
          error,
          "Please refresh the list and try again.",
        ),
      });

      setPendingAction(null);
      setRefreshKey((current) => current + 1);
    } finally {
      setIsProcessingAction(false);
    }
  }

  function clearFilters() {
    setSearchDraft("");
    setSearch("");
    setStatus("");
    setFrequency("");
    setPage(1);
  }

  const totalPages = Math.max(1, pagination?.total_pages ?? 1);

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 sm:py-8">
      <header className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">
          Expenses
        </p>

        <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
          Recurring Expenses
        </h1>

        <p className="max-w-3xl text-sm text-slate-600">
          View scheduled business expenses, their frequency, and their
          next run dates. Purchases are managed separately.
        </p>
        <div className="flex flex-wrap items-center gap-3 pt-2">
          <button
            type="button"
            onClick={() => {
              setEditingRuleId(null);
              setShowCreateForm(true);
            }}
            className="rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
          >
            New recurring expense
          </button>


        </div>
      </header>

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <form
          onSubmit={handleSearch}
          className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_160px_160px_auto]"
        >
          <div>
            <label
              htmlFor="recurring-search"
              className="mb-1.5 block text-xs font-semibold text-slate-600"
            >
              Search rules
            </label>

            <input
              id="recurring-search"
              type="search"
              value={searchDraft}
              maxLength={100}
              onChange={(event) => setSearchDraft(event.target.value)}
              placeholder="Search by rule name"
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
            />
          </div>

          <div>
            <label
              htmlFor="recurring-status"
              className="mb-1.5 block text-xs font-semibold text-slate-600"
            >
              Status
            </label>

            <select
              id="recurring-status"
              value={status}
              onChange={(event) => {
                setStatus(event.target.value as StatusFilter);
                setPage(1);
              }}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900"
            >
              <option value="">All statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
            </select>
          </div>

          <div>
            <label
              htmlFor="recurring-frequency"
              className="mb-1.5 block text-xs font-semibold text-slate-600"
            >
              Frequency
            </label>

            <select
              id="recurring-frequency"
              value={frequency}
              onChange={(event) => {
                setFrequency(event.target.value as FrequencyFilter);
                setPage(1);
              }}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900"
            >
              <option value="">All frequencies</option>
              <option value="DAILY">Daily</option>
              <option value="WEEKLY">Weekly</option>
              <option value="MONTHLY">Monthly</option>
              <option value="YEARLY">Yearly</option>
            </select>
          </div>

          <div className="flex items-end gap-2">
            <button
              type="submit"
              className="rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
            >
              Search
            </button>

            <button
              type="button"
              onClick={clearFilters}
              className="rounded-lg border border-slate-300 px-3 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Clear
            </button>
          </div>
        </form>
      </section>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-4 py-4 sm:px-5">
          <h2 className="text-base font-semibold text-slate-900">
            Scheduled rules
          </h2>

          <span className="text-sm text-slate-500">
            {pagination
              ? `${pagination.total} rule${pagination.total === 1 ? "" : "s"}`
              : "—"}
          </span>
        </div>

        {loading ? (
          <div className="px-5 py-10">
            <LoadingState
              message="Loading recurring expenses..."
              description="Retrieving your scheduled expense rules."
            />
          </div>
        ) : error ? (
          <div
            role="alert"
            className="px-5 py-10 text-center text-sm text-red-700"
          >
            {error}
          </div>
        ) : rules.length === 0 ? (
          <div className="px-5 py-14 text-center">
            <p className="font-medium text-slate-800">
              No recurring expense rules found
            </p>

            <p className="mt-1 text-sm text-slate-500">
              {search || status || frequency
                ? "Try changing or clearing your filters."
                : "Your recurring rules will appear here once you create one."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-[850px] w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th scope="col" className="px-5 py-3 font-semibold">
                    Rule
                  </th>
                  <th scope="col" className="px-5 py-3 font-semibold">
                    Category
                  </th>
                  <th scope="col" className="px-5 py-3 font-semibold">
                    Amount
                  </th>
                  <th scope="col" className="px-5 py-3 font-semibold">
                    Schedule
                  </th>
                  <th scope="col" className="px-5 py-3 font-semibold">
                    Next run
                  </th>
                  <th scope="col" className="px-5 py-3 font-semibold">
                    Status
                  </th>
                  <th scope="col" className="px-5 py-3 font-semibold">
                    Actions
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {rules.map((rule) => (
                  <tr key={rule.id} className="hover:bg-slate-50">
                    <td className="px-5 py-4">
                      <p className="font-semibold text-slate-900">
                        {rule.name}
                      </p>

                      <p className="mt-1 text-xs text-slate-500">
                        {rule.vendor_name ??
                          rule.payee_name ??
                          "No vendor or payee"}
                      </p>
                    </td>

                    <td className="px-5 py-4 text-slate-700">
                      {rule.category_name ?? "—"}
                    </td>

                    <td className="whitespace-nowrap px-5 py-4 font-medium text-slate-900">
                      {formatAmount(
                        rule.amount_paise,
                        rule.currency_code,
                      )}
                    </td>

                    <td className="px-5 py-4">
                      <p className="text-slate-800">
                        {formatFrequency(rule)}
                      </p>

                      {rule.end_date && (
                        <p className="mt-1 text-xs text-slate-500">
                          Ends {formatDate(rule.end_date)}
                        </p>
                      )}
                    </td>

                    <td className="whitespace-nowrap px-5 py-4 text-slate-700">
                      {formatDate(rule.next_run_date)}
                    </td>

                    <td className="px-5 py-4">
                      <span
                        className={
                          rule.is_active === 1
                            ? "inline-flex rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700"
                            : "inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600"
                        }
                      >
                        {rule.is_active === 1 ? "Active" : "Inactive"}
                      </span>
                    </td>

                    <td className="whitespace-nowrap px-5 py-4">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingRuleId(rule.id);
                            setShowCreateForm(true);
                          }}
                          className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                        >
                          Edit
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            setPendingAction({ kind: "toggle", rule })
                          }
                          className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                        >
                          {rule.is_active === 1 ? "Pause" : "Resume"}
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            setPendingAction({ kind: "delete", rule })
                          }
                          className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!loading && !error && pagination && pagination.total > 0 && (
          <div className="flex items-center justify-between gap-3 border-t border-slate-200 px-4 py-4 sm:px-5">
            <p className="text-sm text-slate-600">
              Page {pagination.page} of {totalPages}
            </p>

            <div className="flex gap-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Previous
              </button>

              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((current) => current + 1)}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </section>
      <ConfirmDialog
        open={pendingAction !== null}
        title={
          pendingAction?.kind === "delete"
            ? "Delete recurring expense?"
            : pendingAction?.rule.is_active === 1
              ? "Pause recurring expense?"
              : "Resume recurring expense?"
        }
        description={
          pendingAction?.kind === "delete"
            ? `Delete "${pendingAction.rule.name}"? The rule will be removed from the list, but previously generated expenses will remain.`
            : pendingAction?.rule.is_active === 1
              ? `Pause "${pendingAction.rule.name}"? It will stop generating future expenses until resumed.`
              : pendingAction
                ? `Resume "${pendingAction.rule.name}"? Its scheduled expense generation will be enabled again.`
                : ""
        }
        confirmLabel={
          pendingAction?.kind === "delete"
            ? "Delete rule"
            : pendingAction?.rule.is_active === 1
              ? "Pause rule"
              : "Resume rule"
        }
        tone={
          pendingAction?.kind === "delete"
            ? "danger"
            : pendingAction?.rule.is_active === 1
              ? "warning"
              : "default"
        }
        isProcessing={isProcessingAction}
        onConfirm={confirmRuleAction}
        onCancel={() => {
          if (!isProcessingAction) setPendingAction(null);
        }}
      />

      {showCreateForm && (
        <RecurringExpenseCreateModal
          editingRuleId={editingRuleId ?? undefined}
          onClose={() => {
            setShowCreateForm(false);
            setEditingRuleId(null);
          }}
          onCreated={(saved) => {
            const wasEditing = editingRuleId !== null;

            setShowCreateForm(false);
            setEditingRuleId(null);

            notify({
              type: "success",
              title: wasEditing
                ? "Recurring expense updated"
                : "Recurring expense created",
              description: wasEditing
                ? `"${saved.name}" has been updated successfully.`
                : `"${saved.name}" has been added to your recurring expenses.`,
            });
            setSearchDraft("");
            setSearch("");
            setStatus("");
            setFrequency("");
            setPage(1);
            setRefreshKey((current) => current + 1);
          }}
        />
      )}
    </div>
  );
}
