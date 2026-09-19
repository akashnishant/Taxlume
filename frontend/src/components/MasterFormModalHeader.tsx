import { X } from "lucide-react";

type MasterFormModalHeaderProps = {
  title: string;
  description: string;
  onClose: () => void;
  disabled?: boolean;
};

export default function MasterFormModalHeader({
  title,
  description,
  onClose,
  disabled = false,
}: MasterFormModalHeaderProps) {
  return (
    <div className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-200 px-6 py-4">
      <div className="min-w-0">
        <h2 className="text-lg font-semibold text-slate-900">{title}</h2>

        <p className="mt-1 text-sm text-slate-500">{description}</p>
      </div>

      <button
        type="button"
        aria-label="Close form"
        title="Close"
        onClick={onClose}
        disabled={disabled}
        className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <X size={20} strokeWidth={2} aria-hidden="true" />
      </button>
    </div>
  );
}
