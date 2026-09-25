import { useEffect, useRef, useState, type FormEvent } from "react";
import { X } from "lucide-react";
import LoadingState from "./LoadingState";
import api from "../services/api";
import { getCompany } from "../services/companyApi";
import { getVendors, type Vendor } from "../services/vendorApi";
import {
  createExpense,
  getExpense,
  updateExpense,
  type CreateExpenseRequest,
  type UpdateExpenseRequest,
  type Expense,
  type ExpenseDetails,
  type ExpensePaymentMethod,
} from "../services/expenseApi";
import { getApiErrorMessage } from "../utils/apiErrorMessage";
import { useNotification } from "../hooks/useNotifications";

type Category = {
  id: string;
  name: string;
  parent_category_id: string | null;
  is_active: number;
};

type Props = {
  onClose: () => void;
  onCreated: (expense: Expense) => void;
  editingExpenseId?: string;
};

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

const inputClass =
  "mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 disabled:bg-slate-50 disabled:text-slate-500";

const labelClass = "block text-sm font-medium text-slate-700";

function todayLocal(): string {
  const now = new Date();
  return new Date(
    now.getTime() - now.getTimezoneOffset() * 60_000,
  )
    .toISOString()
    .slice(0, 10);
}

function isValidDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;

  const timestamp = Date.parse(`${value}T00:00:00.000Z`);

  return (
    Number.isFinite(timestamp) &&
    new Date(timestamp).toISOString().slice(0, 10) === value
  );
}

export default function ExpenseCreateModal({
  onClose,
  onCreated,
  editingExpenseId,
}: Props) {
  const notify = useNotification();
  const dateInputRef = useRef<HTMLInputElement>(null);
  const submittingRef = useRef(false);

  const pendingSubmissionRef = useRef<{
    signature: string;
    id: string;
  } | null>(null);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const [categories, setCategories] = useState<Category[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [currency, setCurrency] = useState("INR");
  const [loadedExpense, setLoadedExpense] =
    useState<ExpenseDetails | null>(null);

  const [expenseDate, setExpenseDate] = useState(todayLocal);
  const [categoryId, setCategoryId] = useState("");
  const [amount, setAmount] = useState("");
  const [paymentMethod, setPaymentMethod] =
    useState<ExpensePaymentMethod>("UPI");
  const [vendorId, setVendorId] = useState("");
  const [payeeName, setPayeeName] = useState("");
  const [description, setDescription] = useState("");
  const [referenceNumber, setReferenceNumber] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadOptions() {
      try {
        const [categoryResponse, vendorList, company, existingExpense] =
          await Promise.all([
            api.get<{
              success: boolean;
              categories: Category[];
            }>("/api/expense-categories"),
            getVendors(),
            getCompany(),
            editingExpenseId
              ? getExpense(editingExpenseId)
              : Promise.resolve(null),
          ]);

        if (cancelled) return;

        if (existingExpense && existingExpense.source !== "MANUAL") {
          throw new Error("Only manually recorded expenses can be edited here.");
        }

        setCategories(categoryResponse.data.categories);
        setVendors(vendorList);
        setCurrency(company.currency_code);

        if (existingExpense) {
          setLoadedExpense(existingExpense);
          setExpenseDate(existingExpense.expense_date);
          setCategoryId(existingExpense.category_id);
          setAmount((existingExpense.amount_paise / 100).toFixed(2));
          setPaymentMethod(existingExpense.payment_method);
          setVendorId(existingExpense.vendor_id ?? "");
          setPayeeName(existingExpense.payee_name ?? "");
          setDescription(existingExpense.description ?? "");
          setReferenceNumber(existingExpense.reference_number ?? "");
          setNotes(existingExpense.notes ?? "");
        }
      } catch (error) {
        if (!cancelled) {
          setLoadError(
            getApiErrorMessage(
              error,
              "Unable to load the expense form.",
            ),
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadOptions();

    return () => {
      cancelled = true;
    };
  }, [editingExpenseId]);

  useEffect(() => {
    if (!loading && !loadError) {
      dateInputRef.current?.focus();
    }
  }, [loading, loadError]);

  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape" && !submittingRef.current) {
        onClose();
      }
    }

    window.addEventListener("keydown", handleEscape);

    return () => {
      window.removeEventListener("keydown", handleEscape);
    };
  }, [onClose]);

  const categoryById = new Map(
    categories.map((category) => [category.id, category]),
  );

  const selectableCategories = categories.filter((category) => {
    if (category.is_active !== 1) return false;

    if (!category.parent_category_id) return true;

    return (
      categoryById.get(category.parent_category_id)?.is_active === 1
    );
  });

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (submittingRef.current || loading || loadError) return;

    setFormError("");

    if (!isValidDate(expenseDate)) {
      setFormError("Enter a valid expense date.");
      return;
    }

    if (
      !selectableCategories.some((category) => category.id === categoryId)
    ) {
      setFormError("Select an active expense category.");
      return;
    }

    const trimmedAmount = amount.trim();

    if (!/^\d+(?:\.\d{1,2})?$/.test(trimmedAmount)) {
      setFormError("Enter a valid amount with up to two decimal places.");
      return;
    }

    const amountPaise = Math.round(Number(trimmedAmount) * 100);

    if (
      !Number.isSafeInteger(amountPaise) ||
      amountPaise < 1
    ) {
      setFormError("Enter an amount greater than zero.");
      return;
    }

    const details: Omit<CreateExpenseRequest, "client_request_id"> = {
      expense_date: expenseDate,
      category_id: categoryId,
      amount_paise: amountPaise,
      payment_method: paymentMethod,
      vendor_id: vendorId || null,
      payee_name: vendorId ? null : payeeName.trim() || null,
      description: description.trim() || null,
      reference_number: referenceNumber.trim() || null,
      notes: notes.trim() || null,
    };

    let changes: UpdateExpenseRequest = {};
    let requestId: string | null = null;

    if (editingExpenseId) {
      if (!loadedExpense || loadedExpense.source !== "MANUAL") {
        setFormError("Manual expense details are not available for editing.");
        return;
      }

      if (details.expense_date !== loadedExpense.expense_date) {
        changes.expense_date = details.expense_date;
      }
      if (details.category_id !== loadedExpense.category_id) {
        changes.category_id = details.category_id;
      }
      if (details.amount_paise !== loadedExpense.amount_paise) {
        changes.amount_paise = details.amount_paise;
      }
      if (details.payment_method !== loadedExpense.payment_method) {
        changes.payment_method = details.payment_method;
      }
      if (details.vendor_id !== loadedExpense.vendor_id) {
        changes.vendor_id = details.vendor_id;
      }
      if (details.payee_name !== loadedExpense.payee_name) {
        changes.payee_name = details.payee_name;
      }
      if (details.description !== loadedExpense.description) {
        changes.description = details.description;
      }
      if (details.reference_number !== loadedExpense.reference_number) {
        changes.reference_number = details.reference_number;
      }
      if (details.notes !== loadedExpense.notes) {
        changes.notes = details.notes;
      }

      if (Object.keys(changes).length === 0) {
        setFormError("No changes to save.");
        return;
      }
    } else {
      const signature = JSON.stringify(details);
      const previous = pendingSubmissionRef.current;

      requestId =
        previous?.signature === signature
          ? previous.id
          : crypto.randomUUID();

      pendingSubmissionRef.current = {
        signature,
        id: requestId,
      };
    }

    submittingRef.current = true;
    setSaving(true);

    try {
      const saved = editingExpenseId
        ? await updateExpense(editingExpenseId, changes)
        : await createExpense({
            ...details,
            client_request_id: requestId!,
          });

      onCreated(saved);
    } catch (error) {
      notify({
        type: "error",
        title: editingExpenseId
          ? "Unable to update expense"
          : "Unable to record expense",
        description: getApiErrorMessage(
          error,
          "Please check the details and try again.",
        ),
      });
    } finally {
      submittingRef.current = false;
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="expense-create-title"
        className="flex max-h-[calc(100vh-2rem)] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4 sm:px-6">
          <div>
            <h2
              id="expense-create-title"
              className="text-xl font-bold text-slate-900"
            >
              {editingExpenseId ? "Edit expense" : "Record expense"}
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              {editingExpenseId
                ? "Update the details of this manually recorded expense."
                : "Quickly record a business expense. Purchases are managed separately."}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            aria-label="Close expense form"
            className="rounded-lg p-1 text-slate-500 hover:bg-slate-100 disabled:opacity-50"
          >
            <X size={20} />
          </button>
        </div>

        {loading ? (
          <div className="p-8">
            <LoadingState
              message="Loading expense form..."
              description="Retrieving your categories, vendors, and currency."
            />
          </div>
        ) : loadError ? (
          <div className="space-y-4 p-6">
            <p role="alert" className="text-sm text-red-700">
              {loadError}
            </p>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold"
            >
              Close
            </button>
          </div>
        ) : (
          <form
            onSubmit={(event) => void handleSubmit(event)}
            className="flex min-h-0 flex-col"
          >
            <fieldset
              disabled={saving}
              className="min-h-0 space-y-5 overflow-y-auto px-5 py-5 sm:px-6"
            >
              {formError && (
                <p
                  role="alert"
                  className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700"
                >
                  {formError}
                </p>
              )}

              <div className="grid gap-4 sm:grid-cols-2">
                <label className={labelClass}>
                  Expense date <span className="text-red-600">*</span>
                  <input
                    ref={dateInputRef}
                    type="date"
                    required
                    value={expenseDate}
                    onChange={(event) =>
                      setExpenseDate(event.target.value)
                    }
                    className={inputClass}
                  />
                </label>

                <label className={labelClass}>
                  Amount ({currency}) <span className="text-red-600">*</span>
                  <input
                    type="text"
                    inputMode="decimal"
                    required
                    value={amount}
                    onChange={(event) => setAmount(event.target.value)}
                    placeholder="0.00"
                    className={inputClass}
                  />
                </label>

                <label className={labelClass}>
                  Category <span className="text-red-600">*</span>
                  <select
                    required
                    value={categoryId}
                    onChange={(event) => setCategoryId(event.target.value)}
                    className={inputClass}
                  >
                    <option value="">Select category</option>
                    {selectableCategories.map((category) => {
                      const parent = category.parent_category_id
                        ? categoryById.get(category.parent_category_id)
                        : null;

                      return (
                        <option key={category.id} value={category.id}>
                          {parent
                            ? `${parent.name} / ${category.name}`
                            : category.name}
                        </option>
                      );
                    })}
                  </select>
                  {selectableCategories.length === 0 && (
                    <span className="mt-1 block text-xs text-amber-700">
                      No active expense categories are available.
                    </span>
                  )}
                </label>

                <label className={labelClass}>
                  Payment method <span className="text-red-600">*</span>
                  <select
                    required
                    value={paymentMethod}
                    onChange={(event) =>
                      setPaymentMethod(
                        event.target.value as ExpensePaymentMethod,
                      )
                    }
                    className={inputClass}
                  >
                    {paymentMethods.map((method) => (
                      <option key={method.value} value={method.value}>
                        {method.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className={labelClass}>
                  Vendor (optional)
                  <select
                    value={vendorId}
                    onChange={(event) => {
                      setVendorId(event.target.value);
                      if (event.target.value) setPayeeName("");
                    }}
                    className={inputClass}
                  >
                    <option value="">No vendor selected</option>
                    {vendors.map((vendor) => (
                      <option key={vendor.id} value={vendor.id}>
                        {vendor.display_name}
                      </option>
                    ))}
                  </select>
                </label>

                <label className={labelClass}>
                  Payee name (optional)
                  <input
                    type="text"
                    maxLength={200}
                    value={payeeName}
                    onChange={(event) => setPayeeName(event.target.value)}
                    disabled={Boolean(vendorId)}
                    placeholder={
                      vendorId
                        ? "Using selected vendor"
                        : "Person or business paid"
                    }
                    className={inputClass}
                  />
                </label>
              </div>

              <label className={labelClass}>
                Description (optional)
                <input
                  type="text"
                  maxLength={1000}
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  placeholder="What was this expense for?"
                  className={inputClass}
                />
              </label>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className={labelClass}>
                  Reference number (optional)
                  <input
                    type="text"
                    maxLength={200}
                    value={referenceNumber}
                    onChange={(event) =>
                      setReferenceNumber(event.target.value)
                    }
                    placeholder="Receipt or transaction reference"
                    className={inputClass}
                  />
                </label>

                <label className={labelClass}>
                  Notes (optional)
                  <textarea
                    rows={2}
                    maxLength={5000}
                    value={notes}
                    onChange={(event) => setNotes(event.target.value)}
                    placeholder="Additional details"
                    className={inputClass}
                  />
                </label>
              </div>
            </fieldset>

            <div className="flex flex-wrap justify-end gap-3 border-t border-slate-200 px-5 py-4 sm:px-6">
              <button
                type="button"
                disabled={saving}
                onClick={onClose}
                className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={saving || selectableCategories.length === 0}
                className="rounded-lg bg-lime-300 px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-lime-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving ? "Saving..." : editingExpenseId ? "Save changes" : "Record expense"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}