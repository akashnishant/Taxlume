import { useEffect, useRef, useState, type FormEvent } from "react";
import ConfirmDialog from "./ConfirmDialog";
import LoadingState from "./LoadingState";
import { useNotification } from "../hooks/useNotifications";
import { getApiErrorMessage } from "../utils/apiErrorMessage";
import {
  ALLOWED_RECEIPT_TYPES,
  MAX_RECEIPT_SIZE_BYTES,
  deleteExpenseAttachment,
  downloadExpenseAttachment,
  getExpenseAttachments,
  uploadExpenseAttachment,
  type ExpenseAttachment,
} from "../services/expenseAttachmentApi";

type Props = {
  expenseId: string;
};

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function safeFilename(filename: string): string {
  return filename
    .replace(/[\\/:*?"<>|\u0000-\u001F\u007F]/g, "_")
    .trim()
    .slice(0, 255) || "receipt";
}

export default function ExpenseReceipts({ expenseId }: Props) {
  const notify = useNotification();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [attachments, setAttachments] = useState<ExpenseAttachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [deletingAttachment, setDeletingAttachment] =
    useState<ExpenseAttachment | null>(null);
  const [deleting, setDeleting] = useState(false);

  const busy = uploading || downloadingId !== null || deleting;

  useEffect(() => {
    let cancelled = false;

    setLoading(true);
    setLoadError("");

    getExpenseAttachments(expenseId)
      .then((result) => {
        if (!cancelled) setAttachments(result);
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setLoadError(
            getApiErrorMessage(error, "Unable to load receipts."),
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [expenseId, refreshKey]);

  async function handleUpload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedFile || busy || loading) return;

    if (
      selectedFile.size === 0 ||
      selectedFile.size > MAX_RECEIPT_SIZE_BYTES
    ) {
      notify({
        type: "error",
        title: "Invalid receipt size",
        description: "Choose a non-empty file of 10 MB or less.",
      });
      return;
    }

    if (
      !ALLOWED_RECEIPT_TYPES.some(
        (contentType) => contentType === selectedFile.type,
      )
    ) {
      notify({
        type: "error",
        title: "Unsupported receipt type",
        description: "Choose a PDF, PNG, JPEG, or WebP file.",
      });
      return;
    }

    setUploading(true);

    try {
      await uploadExpenseAttachment(expenseId, selectedFile);

      notify({
        type: "success",
        title: "Receipt uploaded",
        description: `"${selectedFile.name}" was attached to this expense.`,
      });

      setSelectedFile(null);

      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }

      setRefreshKey((current) => current + 1);
    } catch (error) {
      notify({
        type: "error",
        title: "Unable to upload receipt",
        description: getApiErrorMessage(
          error,
          "Check the file and try again.",
        ),
      });
    } finally {
      setUploading(false);
    }
  }

  async function handleDownload(attachment: ExpenseAttachment) {
    if (busy) return;

    setDownloadingId(attachment.id);

    try {
      const blob = await downloadExpenseAttachment(
        expenseId,
        attachment.id,
      );

      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");

      link.href = objectUrl;
      link.download = safeFilename(attachment.original_filename);

      document.body.appendChild(link);
      link.click();
      link.remove();

      // Keep the object URL available long enough for the browser
      // to begin saving the downloaded file.
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
    } catch (error) {
      notify({
        type: "error",
        title: "Unable to download receipt",
        description: getApiErrorMessage(
          error,
          "Please try again.",
        ),
      });
    } finally {
      setDownloadingId(null);
    }
  }

  async function confirmDelete() {
    if (!deletingAttachment || busy) return;

    const attachment = deletingAttachment;
    setDeleting(true);

    try {
      await deleteExpenseAttachment(expenseId, attachment.id);

      setDeletingAttachment(null);
      setRefreshKey((current) => current + 1);

      notify({
        type: "success",
        title: "Receipt removed",
        description: `"${attachment.original_filename}" was removed from this expense.`,
      });
    } catch (error) {
      setDeletingAttachment(null);

      notify({
        type: "error",
        title: "Unable to remove receipt",
        description: getApiErrorMessage(
          error,
          "Please refresh the receipts and try again.",
        ),
      });

      setRefreshKey((current) => current + 1);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <section className="space-y-4 border-t border-slate-200 pt-5">
      <div>
        <h3 className="text-base font-semibold text-slate-900">
          Receipts
        </h3>
        <p className="mt-1 text-sm text-slate-600">
          Attach a PDF or image receipt, up to 10 MB per file.
        </p>
      </div>

      <form onSubmit={(event) => void handleUpload(event)}>
        <div className="flex flex-wrap items-end gap-3">
          <label
            htmlFor="expense-receipt-file"
            className="min-w-0 flex-1 text-sm font-medium text-slate-700"
          >
            Receipt file
            <input
              ref={fileInputRef}
              id="expense-receipt-file"
              type="file"
              accept=".pdf,.png,.jpg,.jpeg,.webp,application/pdf,image/png,image/jpeg,image/webp"
              disabled={busy}
              onChange={(event) =>
                setSelectedFile(event.target.files?.[0] ?? null)
              }
              className="mt-1.5 block w-full min-w-0 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-sm file:font-medium disabled:opacity-50"
            />
          </label>

          <button
            type="submit"
            disabled={!selectedFile || busy || loading}
            className="rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {uploading ? "Uploading..." : "Upload receipt"}
          </button>
        </div>
      </form>

      {loading ? (
        <div className="py-4">
          <LoadingState
            message="Loading receipts..."
            description="Retrieving attachments for this expense."
          />
        </div>
      ) : loadError ? (
        <div className="space-y-2">
          <p role="alert" className="text-sm text-red-700">
            {loadError}
          </p>
          <button
            type="button"
            onClick={() => setRefreshKey((current) => current + 1)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Retry
          </button>
        </div>
      ) : attachments.length === 0 ? (
        <p className="rounded-lg bg-slate-50 px-4 py-3 text-sm text-slate-600">
          No receipts attached yet.
        </p>
      ) : (
        <ul className="divide-y divide-slate-200 rounded-lg border border-slate-200">
          {attachments.map((attachment) => (
            <li
              key={attachment.id}
              className="flex flex-wrap items-center justify-between gap-3 p-3"
            >
              <div className="min-w-0 flex-1">
                <p className="break-all text-sm font-medium text-slate-900">
                  {attachment.original_filename}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {formatSize(attachment.size_bytes)}
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void handleDownload(attachment)}
                  className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                  {downloadingId === attachment.id
                    ? "Downloading..."
                    : "Download"}
                </button>

                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setDeletingAttachment(attachment)}
                  className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
                >
                  Remove
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={deletingAttachment !== null}
        title="Remove receipt?"
        description={
          deletingAttachment
            ? `Remove "${deletingAttachment.original_filename}" from this expense? It will no longer appear in the receipt list.`
            : ""
        }
        confirmLabel="Remove receipt"
        tone="danger"
        isProcessing={deleting}
        onConfirm={confirmDelete}
        onCancel={() => {
          if (!deleting) setDeletingAttachment(null);
        }}
      />
    </section>
  );
}