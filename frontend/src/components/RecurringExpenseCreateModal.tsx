import { useEffect, useState, type FormEvent } from "react";
import axios from "axios";
import { X } from "lucide-react";
import api from "../services/api";
import { getCompany } from "../services/companyApi";
import { getVendors, type Vendor } from "../services/vendorApi";
import {
  createRecurringExpense,
  getRecurringExpense,
  updateRecurringExpense,
  type CreateRecurringExpenseRequest,
  type UpdateRecurringExpenseRequest,
  type RecurringExpenseRule,
  type RecurringFrequency,
  type RecurringPaymentMethod,
} from "../services/recurringExpenseApi";
import LoadingState from "./LoadingState";
import { useNotification } from "../hooks/useNotifications";

type Category = {
  id: string;
  name: string;
  parent_category_id: string | null;
  is_active: number;
};

type Props = {
  onClose: () => void;
  onCreated: (rule: RecurringExpenseRule) => void;
  editingRuleId?: string;
};

const paymentMethods: {
  value: RecurringPaymentMethod;
  label: string;
}[] = [
  { value: "CASH", label: "Cash" },
  { value: "UPI", label: "UPI" },
  { value: "BANK_TRANSFER", label: "Bank transfer" },
  { value: "CHEQUE", label: "Cheque" },
  { value: "CARD", label: "Card" },
  { value: "OTHER", label: "Other" },
];

const frequencies: {
  value: RecurringFrequency;
  label: string;
}[] = [
  { value: "DAILY", label: "Daily" },
  { value: "WEEKLY", label: "Weekly" },
  { value: "MONTHLY", label: "Monthly" },
  { value: "YEARLY", label: "Yearly" },
];

function todayLocal(): string {
  const now = new Date();
  const local = new Date(
    now.getTime() - now.getTimezoneOffset() * 60_000,
  );
  return local.toISOString().slice(0, 10);
}

function errorMessage(error: unknown): string {
  if (axios.isAxiosError<{ message?: string }>(error)) {
    return (
      error.response?.data?.message ??
      error.message ??
      "Unable to create the recurring expense."
    );
  }

  return error instanceof Error
    ? error.message
    : "Unable to create the recurring expense.";
}

const inputClass =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100";

const labelClass =
  "mb-1.5 block text-sm font-medium text-slate-700";

export default function RecurringExpenseCreateModal({
  onClose,
  onCreated,
  editingRuleId,
}: Props) {
  const notify = useNotification();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loadedRule, setLoadedRule] = useState<RecurringExpenseRule | null>(null);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [currency, setCurrency] = useState("INR");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [vendorId, setVendorId] = useState("");
  const [payeeName, setPayeeName] = useState("");
  const [amount, setAmount] = useState("");
  const [paymentMethod, setPaymentMethod] =
    useState<RecurringPaymentMethod>("UPI");
  const [frequency, setFrequency] =
    useState<RecurringFrequency>("MONTHLY");
  const [intervalCount, setIntervalCount] = useState("1");
  const [startDate, setStartDate] = useState(todayLocal);
  const [endDate, setEndDate] = useState("");
  const [description, setDescription] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadOptions() {
      try {
        const [categoryResponse, company, vendorList, existingRule] =
          await Promise.all([
            api.get<{
              success: boolean;
              categories: Category[];
            }>("/api/expense-categories"),
            getCompany(),
            getVendors(),
            editingRuleId
              ? getRecurringExpense(editingRuleId)
              : Promise.resolve(null),
          ]);

        if (cancelled) return;

        setCategories(categoryResponse.data.categories);
        setCurrency(company.currency_code);
        setVendors(vendorList);

        if (existingRule) {
          setLoadedRule(existingRule);
          setName(existingRule.name);
          setCategoryId(existingRule.category_id);
          setVendorId(existingRule.vendor_id ?? "");
          setPayeeName(existingRule.payee_name ?? "");
          setAmount((existingRule.amount_paise / 100).toFixed(2));
          setPaymentMethod(existingRule.payment_method);
          setFrequency(existingRule.frequency);
          setIntervalCount(String(existingRule.interval_count));
          setStartDate(existingRule.start_date);
          setEndDate(existingRule.end_date ?? "");
          setDescription(existingRule.description ?? "");
          setNotes(existingRule.notes ?? "");
        }
      } catch (error) {
        if (!cancelled) {
          setLoadError(errorMessage(error));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadOptions();

    return () => {
      cancelled = true;
    };
  }, [editingRuleId]);

  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape" && !saving) {
        onClose();
      }
    }

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [onClose, saving]);

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

    if (saving) return;

    setFormError("");

    if (!name.trim()) {
      setFormError("Enter a recurring expense name.");
      return;
    }

    if (!selectableCategories.some((item) => item.id === categoryId)) {
      setFormError("Select an active expense category.");
      return;
    }

    const normalizedAmount = amount.trim();

    if (!/^\d+(?:\.\d{1,2})?$/.test(normalizedAmount)) {
      setFormError("Enter a valid amount with up to two decimal places.");
      return;
    }

    const amountPaise = Math.round(Number(normalizedAmount) * 100);

    if (!Number.isSafeInteger(amountPaise) || amountPaise < 1) {
      setFormError("Enter an amount greater than zero.");
      return;
    }

    const interval = Number(intervalCount);

    if (!Number.isSafeInteger(interval) || interval < 1) {
      setFormError("The repeat interval must be a positive whole number.");
      return;
    }

    if (!startDate || (endDate && endDate < startDate)) {
      setFormError("The end date cannot be earlier than the start date.");
      return;
    }

    const request: CreateRecurringExpenseRequest = {
      name: name.trim(),
      category_id: categoryId,
      vendor_id: vendorId || null,
      payee_name: payeeName.trim() || null,
      description: description.trim() || null,
      notes: notes.trim() || null,
      amount_paise: amountPaise,
      payment_method: paymentMethod,
      frequency,
      interval_count: interval,
      start_date: startDate,
      end_date: endDate || null,
    };

    const changes: UpdateRecurringExpenseRequest = {};

    if (editingRuleId) {
      if (!loadedRule) {
        setFormError("The recurring expense details have not loaded.");
        return;
      }

      if (request.name !== loadedRule.name) changes.name = request.name;
      if (request.category_id !== loadedRule.category_id) {
        changes.category_id = request.category_id;
      }
      if (request.vendor_id !== loadedRule.vendor_id) {
        changes.vendor_id = request.vendor_id;
      }
      if (request.payee_name !== loadedRule.payee_name) {
        changes.payee_name = request.payee_name;
      }
      if (request.description !== loadedRule.description) {
        changes.description = request.description;
      }
      if (request.notes !== (loadedRule.notes ?? null)) {
        changes.notes = request.notes;
      }
      if (request.amount_paise !== loadedRule.amount_paise) {
        changes.amount_paise = request.amount_paise;
      }
      if (request.payment_method !== loadedRule.payment_method) {
        changes.payment_method = request.payment_method;
      }
      if (request.frequency !== loadedRule.frequency) {
        changes.frequency = request.frequency;
      }
      if (request.interval_count !== loadedRule.interval_count) {
        changes.interval_count = request.interval_count;
      }
      if (request.start_date !== loadedRule.start_date) {
        changes.start_date = request.start_date;
      }
      if (request.end_date !== loadedRule.end_date) {
        changes.end_date = request.end_date;
      }

      if (Object.keys(changes).length === 0) {
        setFormError("No changes to save.");
        return;
      }
    }

    try {
      setSaving(true);

      const saved = editingRuleId
        ? await updateRecurringExpense(editingRuleId, changes)
        : await createRecurringExpense(request);

      onCreated(saved);
    } catch (error) {
      notify({
        type: "error",
        title: editingRuleId
          ? "Unable to update recurring expense"
          : "Unable to create recurring expense",
        description: errorMessage(error),
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 px-3 py-5 sm:px-6 sm:py-10">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="new-recurring-expense-heading"
        className="mx-auto max-w-3xl overflow-hidden rounded-2xl bg-white shadow-2xl"
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4 sm:px-6">
          <div>
            <h2
              id="new-recurring-expense-heading"
              className="text-xl font-bold text-slate-900"
            >
              {editingRuleId ? "Edit recurring expense" : "New recurring expense"}
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              {editingRuleId ? "Update this recurring rule and its future schedule." : "Set up a schedule for an ongoing business expense."}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            aria-label="Close form"
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 disabled:opacity-50"
          >
            <X size={20} />
          </button>
        </div>

        {loading ? (
          <div className="p-6">
            <LoadingState
              message="Preparing expense form..."
              description="Loading categories, vendors, and company settings."
            />
          </div>
        ) : loadError ? (
          <div role="alert" className="space-y-4 p-6">
            <p className="text-sm text-red-700">{loadError}</p>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm"
            >
              Close
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="grid max-h-[70vh] gap-4 overflow-y-auto p-5 sm:grid-cols-2 sm:p-6">
              <div className="sm:col-span-2">
                <label htmlFor="recurring-name" className={labelClass}>
                  Expense name *
                </label>
                <input
                  id="recurring-name"
                  autoFocus
                  required
                  maxLength={200}
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="e.g. Office rent"
                  className={inputClass}
                />
              </div>

              <div>
                <label htmlFor="recurring-category" className={labelClass}>
                  Category *
                </label>
                <select
                  id="recurring-category"
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
                  <p className="mt-1 text-xs text-amber-700">
                    No active expense categories are available.
                  </p>
                )}
              </div>

              <div>
                <label htmlFor="recurring-amount" className={labelClass}>
                  Amount ({currency}) *
                </label>
                <input
                  id="recurring-amount"
                  required
                  type="text"
                  inputMode="decimal"
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                  placeholder="0.00"
                  className={inputClass}
                />
              </div>

              <div>
                <label htmlFor="recurring-vendor" className={labelClass}>
                  Vendor (optional)
                </label>
                <select
                  id="recurring-vendor"
                  value={vendorId}
                  onChange={(event) => setVendorId(event.target.value)}
                  className={inputClass}
                >
                  <option value="">No vendor</option>
                  {vendors
                    .filter((vendor) => vendor.is_active === 1)
                    .map((vendor) => (
                      <option key={vendor.id} value={vendor.id}>
                        {vendor.display_name}
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label htmlFor="recurring-payee" className={labelClass}>
                  Payee name (optional)
                </label>
                <input
                  id="recurring-payee"
                  maxLength={200}
                  value={payeeName}
                  onChange={(event) => setPayeeName(event.target.value)}
                  placeholder="Who is being paid?"
                  className={inputClass}
                />
              </div>

              <div>
                <label htmlFor="recurring-payment" className={labelClass}>
                  Payment method *
                </label>
                <select
                  id="recurring-payment"
                  value={paymentMethod}
                  onChange={(event) =>
                    setPaymentMethod(
                      event.target.value as RecurringPaymentMethod,
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
              </div>

              <div>
                <label htmlFor="recurring-create-frequency" className={labelClass}>
                  Frequency *
                </label>
                <select
                  id="recurring-create-frequency"
                  value={frequency}
                  onChange={(event) =>
                    setFrequency(event.target.value as RecurringFrequency)
                  }
                  className={inputClass}
                >
                  {frequencies.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="recurring-interval" className={labelClass}>
                  Repeat every *
                </label>
                <input
                  id="recurring-interval"
                  required
                  type="number"
                  min="1"
                  step="1"
                  value={intervalCount}
                  onChange={(event) => setIntervalCount(event.target.value)}
                  className={inputClass}
                />
                <p className="mt-1 text-xs text-slate-500">
                  {frequency.toLowerCase()} interval(s); use 1 for every occurrence.
                </p>
              </div>

              <div>
                <label htmlFor="recurring-start" className={labelClass}>
                  Start date *
                </label>
                <input
                  id="recurring-start"
                  required
                  type="date"
                  disabled={Boolean(loadedRule?.last_run_date)}
                  value={startDate}
                  onChange={(event) => setStartDate(event.target.value)}
                  className={inputClass}
                />
                {loadedRule?.last_run_date && (
                  <p className="mt-1 text-xs text-slate-500">
                    Start date cannot change after expenses have been generated.
                  </p>
                )}
              </div>

              <div>
                <label htmlFor="recurring-end" className={labelClass}>
                  End date (optional)
                </label>
                <input
                  id="recurring-end"
                  type="date"
                  min={startDate}
                  value={endDate}
                  onChange={(event) => setEndDate(event.target.value)}
                  className={inputClass}
                />
              </div>

              <div className="sm:col-span-2">
                <label htmlFor="recurring-description" className={labelClass}>
                  Description (optional)
                </label>
                <textarea
                  id="recurring-description"
                  rows={2}
                  maxLength={1000}
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  className={inputClass}
                />
              </div>

              <div className="sm:col-span-2">
                <label htmlFor="recurring-notes" className={labelClass}>
                  Notes (optional)
                </label>
                <textarea
                  id="recurring-notes"
                  rows={2}
                  maxLength={5000}
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  className={inputClass}
                />
              </div>

              {formError && (
                <p
                  role="alert"
                  className="sm:col-span-2 rounded-lg bg-red-50 p-3 text-sm text-red-700"
                >
                  {formError}
                </p>
              )}
            </div>

            <div className="flex justify-end gap-3 border-t border-slate-200 px-5 py-4 sm:px-6">
              <button
                type="button"
                onClick={onClose}
                disabled={saving}
                className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving || selectableCategories.length === 0}
                className="rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving ? "Saving..." : editingRuleId ? "Save changes" : "Create recurring expense"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
