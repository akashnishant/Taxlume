import axios from "axios";
import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import ButtonLoadingContent from "./ButtonLoadingContent";
import LoadingState from "./LoadingState";
import {
  getInvoiceReceiptHistory,
  recordInvoicePayment,
  reverseInvoiceReceipt,
  type InvoiceReceipt,
  type InvoiceReceiptHistoryResponse,
  type PaymentMethod,
  type RecordInvoicePaymentRequest,
} from "../services/invoiceReceiptsApi";
import { useNotification } from "../hooks/useNotifications";
import ConfirmDialog from "./ConfirmDialog";

type Props = {
  invoiceId: string;
  currencyCode: string;
  onBalanceChange: (amountPaidPaise: number) => void;
  onReceiptHistoryChange: (hasReceipts: boolean | null) => void;
};

const paymentMethods: { value: PaymentMethod; label: string }[] = [
  { value: "UPI", label: "UPI" },
  { value: "BANK_TRANSFER", label: "Bank transfer" },
  { value: "CASH", label: "Cash" },
  { value: "CHEQUE", label: "Cheque" },
  { value: "CARD", label: "Card" },
  { value: "OTHER", label: "Other" },
];

function formatMoney(amountPaise: number, currencyCode: string): string {
  return `${currencyCode} ${(amountPaise / 100).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function todayLocal(): string {
  const today = new Date();

  return [
    today.getFullYear(),
    String(today.getMonth() + 1).padStart(2, "0"),
    String(today.getDate()).padStart(2, "0"),
  ].join("-");
}

function isValidDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;

  const date = new Date(`${value}T00:00:00Z`);

  return (
    !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
  );
}

function amountToPaise(value: string): number | null {
  const trimmed = value.trim();

  // Accept positive amounts with no more than two decimal places.
  if (!/^\d+(?:\.\d{1,2})?$/.test(trimmed)) {
    return null;
  }

  const [whole, fraction = ""] = trimmed.split(".");
  const amountPaise = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));

  if (!Number.isSafeInteger(amountPaise) || amountPaise <= 0) {
    return null;
  }

  return amountPaise;
}

function pendingPaymentStorageKey(invoiceId: string): string {
  return `taxlume:pending-invoice-payment:${invoiceId}`;
}

type RecoveredPayment = {
  submission: RecordInvoicePaymentRequest | null;
  storageError: boolean;
};

function recoverPendingPayment(invoiceId: string): RecoveredPayment {
  try {
    const saved = window.sessionStorage.getItem(
      pendingPaymentStorageKey(invoiceId),
    );

    if (saved === null) {
      return { submission: null, storageError: false };
    }

    const parsed: unknown = JSON.parse(saved);

    if (!parsed || typeof parsed !== "object") {
      return { submission: null, storageError: true };
    }

    const candidate = parsed as Partial<RecordInvoicePaymentRequest>;

    const valid =
      typeof candidate.client_request_id === "string" &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        candidate.client_request_id,
      ) &&
      typeof candidate.amount_paise === "number" &&
      Number.isSafeInteger(candidate.amount_paise) &&
      candidate.amount_paise > 0 &&
      typeof candidate.payment_date === "string" &&
      isValidDate(candidate.payment_date) &&
      paymentMethods.some(
        (method) => method.value === candidate.payment_method,
      ) &&
      (candidate.reference_number === undefined ||
        (typeof candidate.reference_number === "string" &&
          candidate.reference_number.length <= 120)) &&
      (candidate.notes === undefined ||
        (typeof candidate.notes === "string" && candidate.notes.length <= 500));

    if (!valid) {
      return { submission: null, storageError: true };
    }

    return {
      submission: candidate as RecordInvoicePaymentRequest,
      storageError: false,
    };
  } catch {
    // Do not silently start a new submission if a saved one
    // exists but cannot be read.
    return { submission: null, storageError: true };
  }
}

export default function InvoicePaymentsPanel({
  invoiceId,
  currencyCode,
  onBalanceChange,
  onReceiptHistoryChange,
}: Props) {
  const notify = useNotification();

  const [data, setData] = useState<InvoiceReceiptHistoryResponse | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [formError, setFormError] = useState("");
  const [retryKey, setRetryKey] = useState(0);

  const [recoveredPayment] = useState(() => recoverPendingPayment(invoiceId));

  const [pendingSubmission, setPendingSubmission] =
    useState<RecordInvoicePaymentRequest | null>(recoveredPayment.submission);

  const [paymentOutcomeUnknown, setPaymentOutcomeUnknown] = useState(
    recoveredPayment.submission !== null,
  );

  const [storageError, setStorageError] = useState(
    recoveredPayment.storageError,
  );

  const [amount, setAmount] = useState(() =>
    recoveredPayment.submission
      ? (recoveredPayment.submission.amount_paise / 100).toFixed(2)
      : "",
  );

  const [paymentDate, setPaymentDate] = useState(
    recoveredPayment.submission?.payment_date ?? todayLocal,
  );

  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(
    recoveredPayment.submission?.payment_method ?? "UPI",
  );

  const [referenceNumber, setReferenceNumber] = useState(
    recoveredPayment.submission?.reference_number ?? "",
  );

  const [notes, setNotes] = useState(recoveredPayment.submission?.notes ?? "");

  const [pendingReceipt, setPendingReceipt] = useState<InvoiceReceipt | null>(
    null,
  );

  const [reversalReason, setReversalReason] = useState("");
  const [reversalError, setReversalError] = useState("");
  const [isReversing, setIsReversing] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadHistory() {
      setIsLoading(true);
      setLoadError("");
      setData(null);
      onReceiptHistoryChange(null);

      try {
        const result = await getInvoiceReceiptHistory(invoiceId);

        if (!cancelled) {
          setData(result);
          onBalanceChange(result.invoice.amount_paid_paise);
          onReceiptHistoryChange(result.receipts.length > 0);
        }
      } catch {
        if (!cancelled) {
          setLoadError("Unable to load payment history. Please try again.");
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadHistory();

    return () => {
      cancelled = true;
    };
    // The parent callback updates its invoice state; changing that
    // callback should not cause a payment-history refetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invoiceId, retryKey]);

  async function handleRecordPayment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (
      isSaving ||
      isReversing ||
      storageError ||
      !data ||
      data.invoice.status !== "ISSUED"
    ) {
      return;
    }

    setFormError("");

    let submission = pendingSubmission;

    if (!submission) {
      const amountPaise = amountToPaise(amount);

      if (amountPaise === null) {
        setFormError(
          "Enter a valid payment amount with up to two decimal places.",
        );
        return;
      }

      if (amountPaise > data.invoice.outstanding_paise) {
        setFormError("The payment cannot exceed the outstanding balance.");
        return;
      }

      if (!isValidDate(paymentDate)) {
        setFormError("Please enter a valid payment date.");
        return;
      }

      submission = {
        client_request_id: crypto.randomUUID(),
        amount_paise: amountPaise,
        payment_date: paymentDate,
        payment_method: paymentMethod,
        reference_number: referenceNumber.trim() || undefined,
        notes: notes.trim() || undefined,
      };

      // Persist the exact submission BEFORE sending it to the API.
      try {
        window.sessionStorage.setItem(
          pendingPaymentStorageKey(invoiceId),
          JSON.stringify(submission),
        );
      } catch {
        setStorageError(true);
        setFormError(
          "Your browser could not save this payment submission. " +
            "No payment request was sent. Enable session storage and refresh before trying again.",
        );
        return;
      }

      setPendingSubmission(submission);
    }

    setIsSaving(true);

    try {
      const result = await recordInvoicePayment(invoiceId, submission);

      setData((current) => {
        if (!current) return current;

        const receiptAlreadyInHistory = current.receipts.some(
          (receipt) => receipt.id === result.receipt.id,
        );

        return {
          ...current,
          invoice: result.invoice,
          receipts: receiptAlreadyInHistory
            ? current.receipts.map((receipt) =>
                receipt.id === result.receipt.id ? result.receipt : receipt,
              )
            : [result.receipt, ...current.receipts],
        };
      });

      onBalanceChange(result.invoice.amount_paid_paise);
      onReceiptHistoryChange(true);

      try {
        window.sessionStorage.removeItem(pendingPaymentStorageKey(invoiceId));

        setPendingSubmission(null);
        setPaymentOutcomeUnknown(false);
      } catch {
        setStorageError(true);
        setPaymentOutcomeUnknown(true);
        setFormError(
          "The payment was confirmed, but the browser could not clear " +
            "its saved submission. Do not enter a new payment until this is resolved.",
        );
      }

      setAmount("");
      setReferenceNumber("");
      setNotes("");

      notify({
        type: "success",
        title: result.already_recorded
          ? "Payment already recorded"
          : "Payment recorded",
        description: result.already_recorded
          ? "The earlier submission was found. No duplicate payment was added."
          : `${formatMoney(
              result.receipt.amount_paise,
              result.invoice.currency_code,
            )} was recorded against ${result.invoice.document_number}.`,
      });
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const status = error.response?.status;

        const message = (
          error.response?.data as { message?: string } | undefined
        )?.message;

        // These responses definitively reject the submission.
        // The user may correct the form and start a new submission.
        if (
          status === 400 ||
          status === 401 ||
          status === 403 ||
          status === 404 ||
          status === 409
        ) {
          try {
            window.sessionStorage.removeItem(
              pendingPaymentStorageKey(invoiceId),
            );

            setPendingSubmission(null);
            setPaymentOutcomeUnknown(false);
          } catch {
            setStorageError(true);
            setPaymentOutcomeUnknown(true);
            setFormError(
              "The request was rejected, but its saved submission could " +
                "not be cleared. Do not start a new payment until this is resolved.",
            );
            return;
          }

          setFormError(
            message ||
              "The payment was not accepted. Check the details and try again.",
          );
          return;
        }
      }

      // For a network interruption or server error, we cannot assume
      // the payment failed. Retain the ID and exact payment details.
      setPaymentOutcomeUnknown(true);
      setFormError(
        "The payment result could not be confirmed. Select " +
          "'Retry same submission' to safely check or complete this " +
          "payment without creating a duplicate. Do not start a new payment yet.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  function requestReversal(receipt: InvoiceReceipt) {
    if (
      receipt.status !== "RECORDED" ||
      isSaving ||
      isReversing ||
      paymentOutcomeUnknown
    ) {
      return;
    }

    setPendingReceipt(receipt);
    setReversalReason("");
    setReversalError("");
  }

  function closeReversalDialog() {
    if (isReversing) return;

    setPendingReceipt(null);
    setReversalReason("");
    setReversalError("");
  }

  async function handleReverseReceipt() {
    if (
      !pendingReceipt ||
      pendingReceipt.status !== "RECORDED" ||
      isSaving ||
      isReversing ||
      paymentOutcomeUnknown
    ) {
      return;
    }

    const reason = reversalReason.trim();

    if (reason.length < 3 || reason.length > 500) {
      setReversalError("Enter a reversal reason between 3 and 500 characters.");
      return;
    }

    setIsReversing(true);
    setReversalError("");

    try {
      const result = await reverseInvoiceReceipt(
        invoiceId,
        pendingReceipt.id,
        reason,
      );

      setData((current) =>
        current
          ? {
              ...current,
              invoice: result.invoice,
              receipts: current.receipts.map((receipt) =>
                receipt.id === result.receipt.id ? result.receipt : receipt,
              ),
            }
          : current,
      );

      onBalanceChange(result.invoice.amount_paid_paise);

      setPendingReceipt(null);
      setReversalReason("");

      notify({
        type: "success",
        title: "Receipt reversed",
        description:
          `${formatMoney(
            result.receipt.amount_paise,
            result.invoice.currency_code,
          )} has been restored to the outstanding balance. ` +
          "No refund was issued.",
      });
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const message = (
          error.response?.data as { message?: string } | undefined
        )?.message;

        if (message) {
          setReversalError(message);
          return;
        }
      }

      setReversalError(
        "Unable to confirm whether the reversal was completed. " +
          "Refresh the invoice and check Payment History before trying again.",
      );
    } finally {
      setIsReversing(false);
    }
  }

  if (isLoading) {
    return (
      <section className="rounded-lg border border-slate-200 bg-white p-6">
        <LoadingState
          message="Loading payment history..."
          description="Checking the invoice's recorded receipts and balance."
        />
      </section>
    );
  }

  if (loadError || !data) {
    return (
      <section className="rounded-lg border border-red-200 bg-red-50 p-6">
        <p role="alert" className="text-sm text-red-700">
          {loadError || "Unable to display payment details."}
        </p>

        <button
          type="button"
          onClick={() => setRetryKey((value) => value + 1)}
          className="mt-4 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
        >
          Try again
        </button>
      </section>
    );
  }

  const { invoice, receipts } = data;

  const paymentStatus =
    invoice.outstanding_paise <= 0
      ? "Paid"
      : invoice.amount_paid_paise > 0
        ? "Partially paid"
        : "Unpaid";

  const canRecordPayment =
    !storageError &&
    invoice.status === "ISSUED" &&
    (invoice.outstanding_paise > 0 || paymentOutcomeUnknown);

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">
            Customer Payments
          </h2>

          <p className="mt-1 text-sm text-slate-500">
            Record payments already received from your customer. Techabanca Billing does
            not collect or verify these payments.
          </p>
        </div>

        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
          {paymentStatus}
        </span>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg bg-slate-50 p-4">
          <p className="text-xs text-slate-500">Invoice total</p>
          <p className="mt-1 font-semibold text-slate-900">
            {formatMoney(invoice.total_paise, currencyCode)}
          </p>
        </div>

        <div className="rounded-lg bg-slate-50 p-4">
          <p className="text-xs text-slate-500">Amount received</p>
          <p className="mt-1 font-semibold text-slate-900">
            {formatMoney(invoice.amount_paid_paise, currencyCode)}
          </p>
        </div>

        <div className="rounded-lg bg-slate-50 p-4">
          <p className="text-xs text-slate-500">Outstanding</p>
          <p className="mt-1 font-semibold text-slate-900">
            {formatMoney(invoice.outstanding_paise, currencyCode)}
          </p>
        </div>
      </div>

      {paymentOutcomeUnknown && !storageError && (
        <p
          role="alert"
          className="mt-5 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800"
        >
          A payment submission was recovered for this invoice. Its outcome may
          already be recorded. Select "Retry same submission" to check it
          without generating a new payment ID.
        </p>
      )}

      {storageError && (
        <p
          role="alert"
          className="mt-5 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"
        >
          The saved payment submission could not be accessed or validated.
          Recording another payment is blocked to avoid a possible duplicate.
          Check Payment History before resolving the browser storage issue.
        </p>
      )}

      {canRecordPayment ? (
        <form
          onSubmit={(event) => void handleRecordPayment(event)}
          className="mt-6 space-y-4 border-t border-slate-200 pt-6"
        >
          <h3 className="font-semibold text-slate-900">Record Payment</h3>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label
                htmlFor="receipt-amount"
                className="mb-1 block text-sm font-medium text-slate-700"
              >
                Amount received ({currencyCode})
              </label>

              <input
                id="receipt-amount"
                type="text"
                inputMode="decimal"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                placeholder="0.00"
                disabled={isSaving || isReversing || paymentOutcomeUnknown}
                required
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label
                htmlFor="receipt-date"
                className="mb-1 block text-sm font-medium text-slate-700"
              >
                Payment date
              </label>

              <input
                id="receipt-date"
                type="date"
                value={paymentDate}
                onChange={(event) => setPaymentDate(event.target.value)}
                disabled={isSaving || isReversing || paymentOutcomeUnknown}
                required
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label
                htmlFor="receipt-method"
                className="mb-1 block text-sm font-medium text-slate-700"
              >
                Payment method
              </label>

              <select
                id="receipt-method"
                value={paymentMethod}
                onChange={(event) =>
                  setPaymentMethod(event.target.value as PaymentMethod)
                }
                disabled={isSaving || isReversing || paymentOutcomeUnknown}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              >
                {paymentMethods.map((method) => (
                  <option key={method.value} value={method.value}>
                    {method.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="receipt-reference"
                className="mb-1 block text-sm font-medium text-slate-700"
              >
                Transaction reference (optional)
              </label>

              <input
                id="receipt-reference"
                type="text"
                maxLength={120}
                value={referenceNumber}
                onChange={(event) => setReferenceNumber(event.target.value)}
                disabled={isSaving || isReversing || paymentOutcomeUnknown}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="receipt-notes"
              className="mb-1 block text-sm font-medium text-slate-700"
            >
              Notes (optional)
            </label>

            <textarea
              id="receipt-notes"
              maxLength={500}
              rows={2}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              disabled={isSaving || isReversing || paymentOutcomeUnknown}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>

          {formError && (
            <p role="alert" className="text-sm text-red-600">
              {formError}
            </p>
          )}

          <button
            type="submit"
            disabled={isSaving || isReversing}
            className="rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSaving ? (
              <ButtonLoadingContent
                message={
                  paymentOutcomeUnknown
                    ? "Checking payment submission..."
                    : "Recording payment..."
                }
              />
            ) : paymentOutcomeUnknown ? (
              "Retry same submission"
            ) : (
              "Record Payment"
            )}
          </button>
        </form>
      ) : (
        <p className="mt-6 border-t border-slate-200 pt-5 text-sm text-slate-600">
          {invoice.status !== "ISSUED"
            ? "Payments cannot be recorded against this invoice in its current status."
            : "This invoice has no outstanding balance."}
        </p>
      )}

      <div className="mt-6 border-t border-slate-200 pt-6">
        <h3 className="font-semibold text-slate-900">Payment History</h3>

        {receipts.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">
            No payments have been recorded for this invoice.
          </p>
        ) : (
          <div className="mt-4 divide-y divide-slate-100">
            {receipts.map((receipt) => (
              <div
                key={receipt.id}
                className="flex flex-wrap justify-between gap-3 py-3"
              >
                <div className="text-sm text-slate-600">
                  <p className="font-medium text-slate-900">
                    {receipt.payment_date} ·{" "}
                    {paymentMethods.find(
                      (method) => method.value === receipt.payment_method,
                    )?.label ?? receipt.payment_method}
                  </p>

                  {receipt.reference_number && (
                    <p className="mt-1">
                      Reference: {receipt.reference_number}
                    </p>
                  )}

                  {receipt.notes && <p className="mt-1">{receipt.notes}</p>}

                  {receipt.status === "REVERSED" && (
                    <p className="mt-1 text-red-600">
                      Reversed:{" "}
                      {receipt.reversal_reason || "No reason provided"}
                    </p>
                  )}
                </div>

                <div className="flex flex-col items-end gap-2">
                  <p
                    className={`text-sm font-semibold ${
                      receipt.status === "REVERSED"
                        ? "text-slate-400 line-through"
                        : "text-slate-900"
                    }`}
                  >
                    {formatMoney(receipt.amount_paise, currencyCode)}
                  </p>

                  {receipt.status === "RECORDED" ? (
                    <button
                      type="button"
                      onClick={() => requestReversal(receipt)}
                      disabled={
                        isSaving ||
                        isReversing ||
                        paymentOutcomeUnknown ||
                        pendingReceipt !== null
                      }
                      className="text-xs font-semibold text-red-600 hover:underline disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Reverse Receipt
                    </button>
                  ) : (
                    <span className="text-xs font-semibold text-red-600">
                      Reversed
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      <ConfirmDialog
        open={pendingReceipt !== null}
        title="Reverse recorded receipt?"
        description={
          <div className="space-y-3">
            <p>
              {pendingReceipt
                ? `Reverse the recorded payment of ${formatMoney(
                    pendingReceipt.amount_paise,
                    currencyCode,
                  )}?`
                : ""}
            </p>

            <p className="text-sm text-slate-600">
              The receipt will remain in Payment History, and its amount will be
              added back to the invoice's outstanding balance. This does not
              issue a refund.
            </p>

            <div>
              <label
                htmlFor="receipt-reversal-reason"
                className="mb-1 block text-sm font-medium text-slate-700"
              >
                Reason for reversal
              </label>

              <textarea
                id="receipt-reversal-reason"
                value={reversalReason}
                onChange={(event) => {
                  setReversalReason(event.target.value);
                  setReversalError("");
                }}
                disabled={isReversing}
                maxLength={500}
                rows={3}
                placeholder="For example: Incorrect amount recorded"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>

            {reversalError && (
              <p role="alert" className="text-sm text-red-600">
                {reversalError}
              </p>
            )}
          </div>
        }
        confirmLabel="Reverse receipt"
        cancelLabel="Keep receipt"
        tone="danger"
        isProcessing={isReversing}
        onConfirm={() => handleReverseReceipt()}
        onCancel={closeReversalDialog}
      />
    </section>
  );
}
