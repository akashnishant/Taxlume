import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import LoadingState from "../components/LoadingState";
import ExpenseCreateModal from "../components/ExpenseCreateModal";
import ExpenseDetailsModal from "../components/ExpenseDetailsModal";
import ConfirmDialog from "../components/ConfirmDialog";
import { useNotification } from "../hooks/useNotifications";
import api from "../services/api";
import { getVendors } from "../services/vendorApi";
import {
  getExpenses,
  deleteExpense,
  type Expense,
  type ExpensePagination,
  type ExpensePaymentMethod,
  type ExpenseSource,
} from "../services/expenseApi";
import { getApiErrorMessage } from "../utils/apiErrorMessage";

type Category = {
  id: string;
  name: string;
  parent_category_id: string | null;
  is_active: number;
};

type VendorOption = {
  id: string;
  display_name: string;
};

const PAGE_SIZE = 20;

const paymentMethods: {
  value: ExpensePaymentMethod;
  label: string;
}[] = [
  { value: "CASH", label: "Cash" },
  { value: "UPI", label: "UPI" },
  { value: "BANK_TRANSFER", label: "Bank transfer" },
  { value: "CHEQUE", label: "Cheque" },
  { value: "CARD", label: "Card" },
  { value: "OTHER", label: "Other" },
];

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

function formatDate(value: string): string {
  const date = new Date(`${value}T00:00:00Z`);

  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

function paymentMethodLabel(value: ExpensePaymentMethod): string {
  return paymentMethods.find((method) => method.value === value)?.label ?? value;
}

export default function AllExpenses() {
  const notify = useNotification();
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);
  const [viewingExpenseId, setViewingExpenseId] = useState<string | null>(null);
  const [deletingExpense, setDeletingExpense] = useState<Expense | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [pagination, setPagination] = useState<ExpensePagination | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [categories, setCategories] = useState<Category[]>([]);
  const [vendors, setVendors] = useState<VendorOption[]>([]);
  const [optionsLoading, setOptionsLoading] = useState(true);
  const [optionsError, setOptionsError] = useState("");

  const [searchDraft, setSearchDraft] = useState("");
  const [search, setSearch] = useState("");

  const [startDateDraft, setStartDateDraft] = useState("");
  const [endDateDraft, setEndDateDraft] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const [categoryId, setCategoryId] = useState("");
  const [vendorId, setVendorId] = useState("");
  const [paymentMethod, setPaymentMethod] =
    useState<ExpensePaymentMethod | "">("");
  const [source, setSource] = useState<ExpenseSource | "">("");
  const [filterError, setFilterError] = useState("");
  const [page, setPage] = useState(1);

  useEffect(() => {
    let cancelled = false;

    async function loadFilterOptions() {
      try {
        const [categoryResponse, vendorList] = await Promise.all([
          api.get<{
            success: boolean;
            categories: Category[];
          }>("/api/expense-categories"),
          getVendors(),
        ]);

        if (cancelled) return;

        setCategories(categoryResponse.data.categories);
        setVendors(vendorList);
      } catch (requestError) {
        if (!cancelled) {
          setOptionsError(
            getApiErrorMessage(
              requestError,
              "Unable to load category and vendor filters.",
            ),
          );
        }
      } finally {
        if (!cancelled) setOptionsLoading(false);
      }
    }

    void loadFilterOptions();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    setLoading(true);
    setError("");

    getExpenses({
      page,
      limit: PAGE_SIZE,
      search: search || undefined,
      start_date: startDate || undefined,
      end_date: endDate || undefined,
      category_id: categoryId || undefined,
      vendor_id: vendorId || undefined,
      payment_method: paymentMethod || undefined,
      source: source || undefined,
    })
      .then((result) => {
        if (cancelled) return;

        setExpenses(result.expenses);
        setPagination(result.pagination);
      })
      .catch((requestError: unknown) => {
        if (cancelled) return;

        setExpenses([]);
        setPagination(null);
        setError(
          getApiErrorMessage(requestError, "Unable to load expenses."),
        );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [
    page,
    search,
    startDate,
    endDate,
    categoryId,
    vendorId,
    paymentMethod,
    source,
    refreshKey,
  ]);

  async function confirmDeleteExpense() {
    if (
      !deletingExpense ||
      deletingExpense.source !== "MANUAL" ||
      isDeleting
    ) {
      return;
    }

    const expense = deletingExpense;
    setIsDeleting(true);

    try {
      await deleteExpense(expense.id);

      setDeletingExpense(null);
      setPage(1);
      setRefreshKey((current) => current + 1);

      notify({
        type: "success",
        title: "Expense deleted",
        description: `"${expense.description || "Business expense"}" has been deleted.`,
      });
    } catch (requestError) {
      setDeletingExpense(null);
      setRefreshKey((current) => current + 1);

      notify({
        type: "error",
        title: "Unable to delete expense",
        description: getApiErrorMessage(
          requestError,
          "Please refresh the list and try again.",
        ),
      });
    } finally {
      setIsDeleting(false);
    }
  }

  function applyFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (
      startDateDraft &&
      endDateDraft &&
      startDateDraft > endDateDraft
    ) {
      setFilterError("Start date cannot be after end date.");
      return;
    }

    setFilterError("");
    setPage(1);
    setSearch(searchDraft.trim());
    setStartDate(startDateDraft);
    setEndDate(endDateDraft);
  }

  function clearFilters() {
    setSearchDraft("");
    setSearch("");
    setStartDateDraft("");
    setEndDateDraft("");
    setStartDate("");
    setEndDate("");
    setCategoryId("");
    setVendorId("");
    setPaymentMethod("");
    setSource("");
    setFilterError("");
    setPage(1);
  }

  const totalPages = pagination?.total_pages ?? 0;

  return (
    <main className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 sm:py-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Expenses</h1>
          <p className="mt-1 text-sm text-slate-600">
            View business expenses recorded manually or generated from recurring rules.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 border-b border-slate-200">
        <span
          aria-current="page"
          className="border-b-2 border-emerald-600 px-4 py-3 text-sm font-semibold text-emerald-700"
        >
          All expenses
        </span>
        <Link
          to="/expenses/recurring"
          className="px-4 py-3 text-sm font-medium text-slate-600 hover:text-slate-900"
        >
          Recurring expenses
        </Link>
      </div>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => {
            setEditingExpenseId(null);
            setShowCreateForm(true);
          }}
          className="rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
        >
          Record expense
        </button>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
        <form onSubmit={applyFilters} className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <label className="block text-sm font-medium text-slate-700 lg:col-span-2">
              Search
              <input
                type="search"
                value={searchDraft}
                onChange={(event) => setSearchDraft(event.target.value)}
                placeholder="Search expenses"
                maxLength={100}
                className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-emerald-600"
              />
            </label>

            <label className="block text-sm font-medium text-slate-700">
              From date
              <input
                type="date"
                value={startDateDraft}
                onChange={(event) => setStartDateDraft(event.target.value)}
                className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-emerald-600"
              />
            </label>

            <label className="block text-sm font-medium text-slate-700">
              To date
              <input
                type="date"
                value={endDateDraft}
                onChange={(event) => setEndDateDraft(event.target.value)}
                className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-emerald-600"
              />
            </label>

            <label className="block text-sm font-medium text-slate-700">
              Category
              <select
                value={categoryId}
                onChange={(event) => {
                  setCategoryId(event.target.value);
                  setPage(1);
                }}
                disabled={optionsLoading || Boolean(optionsError)}
                className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-emerald-600 disabled:opacity-60"
              >
                <option value="">All categories</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="block text-sm font-medium text-slate-700">
              Vendor
              <select
                value={vendorId}
                onChange={(event) => {
                  setVendorId(event.target.value);
                  setPage(1);
                }}
                disabled={optionsLoading || Boolean(optionsError)}
                className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-emerald-600 disabled:opacity-60"
              >
                <option value="">All vendors</option>
                {vendors.map((vendor) => (
                  <option key={vendor.id} value={vendor.id}>
                    {vendor.display_name}
                  </option>
                ))}
              </select>
            </label>

            <label className="block text-sm font-medium text-slate-700">
              Payment method
              <select
                value={paymentMethod}
                onChange={(event) => {
                  setPaymentMethod(
                    event.target.value as ExpensePaymentMethod | "",
                  );
                  setPage(1);
                }}
                className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-emerald-600"
              >
                <option value="">All payment methods</option>
                {paymentMethods.map((method) => (
                  <option key={method.value} value={method.value}>
                    {method.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="block text-sm font-medium text-slate-700">
              Source
              <select
                value={source}
                onChange={(event) => {
                  setSource(event.target.value as ExpenseSource | "");
                  setPage(1);
                }}
                className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-emerald-600"
              >
                <option value="">All sources</option>
                <option value="MANUAL">Manual</option>
                <option value="RECURRING">Recurring</option>
              </select>
            </label>
          </div>

          {optionsError && (
            <p role="alert" className="text-sm text-amber-700">
              {optionsError}
            </p>
          )}

          {filterError && (
            <p role="alert" className="text-sm text-red-700">
              {filterError}
            </p>
          )}

          <div className="flex flex-wrap gap-2">
            <button
              type="submit"
              className="rounded-lg bg-lime-300 px-4 py-2.5 text-sm font-semibold text-slate-950 hover:bg-lime-200"
            >
              Apply filters
            </button>

            <button
              type="button"
              onClick={clearFilters}
              className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Clear filters
            </button>
          </div>
        </form>
      </section>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-5 py-4">
          <h2 className="text-base font-semibold text-slate-900">
            All expenses
          </h2>
          <span className="text-sm text-slate-500">
            {pagination
              ? `${pagination.total} expense${pagination.total === 1 ? "" : "s"}`
              : "-"}
          </span>
        </div>

        {loading ? (
          <div className="px-5 py-10">
            <LoadingState
              message="Loading expenses..."
              description="Retrieving your business expense records."
            />
          </div>
        ) : error ? (
          <div
            role="alert"
            className="px-5 py-10 text-center text-sm text-red-700"
          >
            {error}
          </div>
        ) : expenses.length === 0 ? (
          <div className="px-5 py-14 text-center">
            <p className="font-medium text-slate-800">
              No expenses found
            </p>
            <p className="mt-1 text-sm text-slate-500">
              Expenses will appear here once they are recorded or generated.
              If filters are applied, try clearing them.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[950px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th scope="col" className="px-5 py-3 font-semibold">
                    Date
                  </th>
                  <th scope="col" className="px-5 py-3 font-semibold">
                    Expense
                  </th>
                  <th scope="col" className="px-5 py-3 font-semibold">
                    Category
                  </th>
                  <th scope="col" className="px-5 py-3 font-semibold">
                    Payee / vendor
                  </th>
                  <th scope="col" className="px-5 py-3 font-semibold">
                    Payment
                  </th>
                  <th scope="col" className="px-5 py-3 font-semibold">
                    Source
                  </th>
                  <th scope="col" className="px-5 py-3 text-right font-semibold">
                    Amount
                  </th>
                  <th scope="col" className="px-5 py-3 font-semibold">
                    Actions
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {expenses.map((expense) => (
                  <tr key={expense.id} className="hover:bg-slate-50">
                    <td className="whitespace-nowrap px-5 py-4 text-slate-700">
                      {formatDate(expense.expense_date)}
                    </td>

                    <td className="px-5 py-4">
                      <p className="font-medium text-slate-900">
                        {expense.description || expense.reference_number || "Expense"}
                      </p>
                      {expense.reference_number && expense.description && (
                        <p className="mt-1 text-xs text-slate-500">
                          Ref: {expense.reference_number}
                        </p>
                      )}
                    </td>

                    <td className="px-5 py-4 text-slate-700">
                      {expense.parent_category_name
                        ? `${expense.parent_category_name} / ${expense.category_name ?? "-"}`
                        : expense.category_name ?? "-"}
                    </td>

                    <td className="px-5 py-4 text-slate-700">
                      {expense.vendor_name ?? expense.payee_name ?? "-"}
                    </td>

                    <td className="whitespace-nowrap px-5 py-4 text-slate-700">
                      {paymentMethodLabel(expense.payment_method)}
                    </td>

                    <td className="px-5 py-4">
                      <span
                        className={
                          expense.source === "RECURRING"
                            ? "inline-flex rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700"
                            : "inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700"
                        }
                      >
                        {expense.source === "RECURRING"
                          ? "Recurring"
                          : "Manual"}
                      </span>
                    </td>

                    <td className="whitespace-nowrap px-5 py-4 text-right font-semibold text-slate-900">
                      {formatAmount(
                        expense.amount_paise,
                        expense.currency_code,
                      )}
                    </td>

                    <td className="whitespace-nowrap px-5 py-4">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setViewingExpenseId(expense.id)}
                          className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                        >
                          View
                        </button>

                        {expense.source === "MANUAL" && (
                          <>
                            <button
                              type="button"
                              onClick={() => {
                                setEditingExpenseId(expense.id);
                                setShowCreateForm(true);
                              }}
                              className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                            >
                              Edit
                            </button>

                            <button
                              type="button"
                              onClick={() => setDeletingExpense(expense)}
                              className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50"
                            >
                              Delete
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!loading &&
          !error &&
          pagination &&
          pagination.total > 0 && (
            <div className="flex items-center justify-between gap-3 border-t border-slate-200 px-5 py-4">
              <p className="text-sm text-slate-600">
                Page {pagination.page} of {totalPages}
              </p>

              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() =>
                    setPage((current) => Math.max(1, current - 1))
                  }
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
        open={deletingExpense !== null}
        title="Delete expense?"
        description={
          deletingExpense
            ? `Delete "${deletingExpense.description || "Business expense"}" (${formatAmount(deletingExpense.amount_paise, deletingExpense.currency_code)})? This expense will no longer appear in your expense list.`
            : ""
        }
        confirmLabel="Delete expense"
        tone="danger"
        isProcessing={isDeleting}
        onConfirm={confirmDeleteExpense}
        onCancel={() => {
          if (!isDeleting) setDeletingExpense(null);
        }}
      />

      {viewingExpenseId && (
        <ExpenseDetailsModal
          expenseId={viewingExpenseId}
          onClose={() => setViewingExpenseId(null)}
        />
      )}

      {showCreateForm && (
        <ExpenseCreateModal
          editingExpenseId={editingExpenseId ?? undefined}
          onClose={() => {
            setShowCreateForm(false);
            setEditingExpenseId(null);
          }}
          onCreated={(saved) => {
            const wasEditing = editingExpenseId !== null;

            setShowCreateForm(false);
            setEditingExpenseId(null);
            clearFilters();
            setRefreshKey((current) => current + 1);

            notify({
              type: "success",
              title: wasEditing ? "Expense updated" : "Expense recorded",
              description: wasEditing
                ? `"${saved.description || "Business expense"}" has been updated successfully.`
                : `Your ${saved.currency_code} ${(saved.amount_paise / 100).toFixed(2)} expense has been recorded successfully.`,
            });
          }}
        />
      )}
    </main>
  );
}