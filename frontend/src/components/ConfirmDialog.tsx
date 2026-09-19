import { useEffect, useId, useRef, type ReactNode } from "react";

import { AlertTriangle, CircleHelp, LoaderCircle, X } from "lucide-react";

type ConfirmDialogProps = {
  open: boolean;
  title: string;
  description: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  tone?: "default" | "warning" | "danger";
  isProcessing?: boolean;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
};

export default function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel = "Cancel",
  tone = "default",
  isProcessing = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const cancelButtonRef = useRef<HTMLButtonElement>(null);

  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;

    if (!dialog) {
      return;
    }

    if (open && !dialog.open) {
      dialog.showModal();
      cancelButtonRef.current?.focus();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  const isDanger = tone === "danger";
  const isWarning = tone === "warning";

  const iconColor = isDanger
    ? "text-red-600"
    : isWarning
      ? "text-amber-600"
      : "text-slate-700";

  const iconBackground = isDanger
    ? "bg-red-50"
    : isWarning
      ? "bg-amber-50"
      : "bg-slate-100";

  const confirmButtonColor = isDanger
    ? "bg-red-600 hover:bg-red-700"
    : isWarning
      ? "bg-amber-600 hover:bg-amber-700"
      : "bg-slate-900 hover:bg-slate-800";

  const Icon = isDanger || isWarning ? AlertTriangle : CircleHelp;

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      aria-modal="true"
      onCancel={(event) => {
        event.preventDefault();

        if (!isProcessing) {
          onCancel();
        }
      }}
      className="m-auto w-[calc(100%-2rem)] max-w-md rounded-2xl border border-slate-200 bg-white p-0 text-slate-900 shadow-2xl backdrop:bg-slate-900/50"
    >
      <div className="p-6">
        <div className="flex items-start gap-4">
          <div
            className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${iconBackground}`}
          >
            <Icon size={24} className={iconColor} aria-hidden="true" />
          </div>

          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="text-lg font-semibold text-slate-900">
              {title}
            </h2>

            <div
              id={descriptionId}
              className="mt-2 text-sm leading-6 text-slate-600"
            >
              {description}
            </div>
          </div>

          <button
            type="button"
            disabled={isProcessing}
            onClick={onCancel}
            aria-label="Close confirmation dialog"
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <X size={19} />
          </button>
        </div>

        <div className="mt-7 flex flex-wrap justify-end gap-3">
          <button
            ref={cancelButtonRef}
            type="button"
            disabled={isProcessing}
            onClick={onCancel}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {cancelLabel}
          </button>

          <button
            type="button"
            disabled={isProcessing}
            onClick={() => void onConfirm()}
            className={`inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-60 ${confirmButtonColor}`}
          >
            {isProcessing && (
              <LoaderCircle
                size={16}
                className="motion-safe:animate-spin"
                aria-hidden="true"
              />
            )}

            {isProcessing ? "Processing..." : confirmLabel}
          </button>
        </div>
      </div>
    </dialog>
  );
}
