import { useEffect, useState } from "react";
import { X } from "lucide-react";
import LoadingState from "./LoadingState";
import ExpenseReceipts from "./ExpenseReceipts";
import {
  getExpense,
  type ExpenseDetails,
  type ExpensePaymentMethod,
} from "../services/expenseApi";
import { getApiErrorMessage } from "../utils/apiErrorMessage";

type Props = {
  expenseId: string;
  onClose: () => void;
};

const paymentMethodLabels: Record<ExpensePaymentMethod, string> = {
  CASH: "Cash",
  UPI: "UPI",
  BANK_TRANSFER: "Bank transfer",
  CHEQUE: "Cheque",
  CARD: "Card",
  OTHER: "Other",
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

function Detail({
  label,
  value,
}: {
  label: string;
  value: string | null | undefined;
}) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </dt>
      <dd className="mt-1 break-words text-sm text-slate-900">
        {value || "-"}
      </dd>
    </div>
  );
}

export default function ExpenseDetailsModal({
  expenseId,
  onClose,
}: Props) {
  const [expense, setExpense] = useState<ExpenseDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    setLoading(true);
    setError("");
    setExpense(null);

    getExpense(expenseId)
      .then((result) => {
        if (!cancelled) setExpense(result);
      })
      .catch((requestError: unknown) => {
        if (!cancelled) {
          setError(
            getApiErrorMessage(
              requestError,
              "Unable to load expense details.",
            ),
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [expenseId]);

  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }

    window.addEventListener("keydown", handleEscape);

    return () => {
      window.removeEventListener("keydown", handleEscape);
    };
  }, [onClose]);

  const categoryLabel = expense
    ? expense.parent_category_name
      ? `${expense.parent_category_name} / ${expense.category_name ?? "-"}`
      : expense.category_name ?? "-"
    : "-";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="expense-details-title"
        className="flex max-h-[calc(100vh-2rem)] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4 sm:px-6">
          <div>
            <h2
              id="expense-details-title"
              className="text-xl font-bold text-slate-900"
            >
              Expense details
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Review the recorded expense information.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close expense details"
            className="rounded-lg p-1 text-slate-500 hover:bg-slate-100"
          >
            <X size={20} />
          </button>
        </div>

        <div className="min-h-0 overflow-y-auto px-5 py-5 sm:px-6">
          {loading ? (
            <LoadingState
              message="Loading expense details..."
              description="Retrieving the selected expense."
            />
          ) : error ? (
            <p role="alert" className="text-sm text-red-700">
              {error}
            </p>
          ) : expense ? (
            <div className="space-y-6">
              <div className="flex flex-wrap items-start justify-between gap-3 rounded-xl bg-slate-50 p-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    {expense.source === "RECURRING"
                      ? "Recurring-generated expense"
                      : "Manual expense"}
                  </p>
                  <p className="mt-1 text-lg font-semibold text-slate-900">
                    {expense.description || "Business expense"}
                  </p>
                </div>
                <p className="text-xl font-bold text-slate-900">
                  {formatAmount(
                    expense.amount_paise,
                    expense.currency_code,
                  )}
                </p>
              </div>

              <dl className="grid gap-x-6 gap-y-5 sm:grid-cols-2">
                <Detail
                  label="Expense date"
                  value={formatDate(expense.expense_date)}
                />
                <Detail label="Category" value={categoryLabel} />
                <Detail
                  label="Vendor / payee"
                  value={expense.vendor_name ?? expense.payee_name}
                />
                <Detail
                  label="Payment method"
                  value={
                    paymentMethodLabels[expense.payment_method] ??
                    expense.payment_method
                  }
                />
                <Detail
                  label="Reference number"
                  value={expense.reference_number}
                />
                <Detail
                  label="Source"
                  value={
                    expense.source === "RECURRING"
                      ? "Recurring"
                      : "Manual"
                  }
                />
              </dl>

              <dl className="space-y-5 border-t border-slate-200 pt-5">
                <Detail
                  label="Description"
                  value={expense.description}
                />
                <Detail label="Notes" value={expense.notes} />

                {expense.source === "RECURRING" && (
                  <>
                    <Detail
                      label="Recurring occurrence date"
                      value={
                        expense.recurring_occurrence_date
                          ? formatDate(expense.recurring_occurrence_date)
                          : null
                      }
                    />
                    <Detail
                      label="Recurring rule ID"
                      value={expense.recurring_rule_id}
                    />
                  </>
                )}
              </dl>

              <ExpenseReceipts expenseId={expense.id} />
            </div>
          ) : (
            <p className="text-sm text-slate-600">
              Expense details are unavailable.
            </p>
          )}
        </div>

        <div className="flex justify-end border-t border-slate-200 px-5 py-4 sm:px-6">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}