import { LoaderCircle } from "lucide-react";

type LoadingStateProps = {
  message: string;
  description?: string;
  variant?: "screen" | "page" | "inline";
};

export default function LoadingState({
  message,
  description,
  variant = "page",
}: LoadingStateProps) {
  const isInline = variant === "inline";

  const content = (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className={
        isInline
          ? "flex items-center gap-2"
          : "flex flex-col items-center text-center"
      }
    >
      <div
        className={
          isInline
            ? "flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-100"
            : "flex h-16 w-16 items-center justify-center rounded-2xl border border-slate-200 bg-white shadow-sm"
        }
      >
        <LoaderCircle
          size={isInline ? 18 : 30}
          className="motion-safe:animate-spin text-slate-700"
          aria-hidden="true"
        />
      </div>

      <div className={isInline ? "" : "mt-4"}>
        <p className="text-sm font-semibold text-slate-800">{message}</p>

        {description && (
          <p className="mt-1 max-w-sm text-sm text-slate-500">{description}</p>
        )}
      </div>
    </div>
  );

  if (variant === "inline") {
    return content;
  }

  return (
    <div
      className={
        variant === "screen"
          ? "flex min-h-screen items-center justify-center bg-slate-100 px-6"
          : "flex min-h-[220px] items-center justify-center px-6 py-10"
      }
    >
      {content}
    </div>
  );
}
