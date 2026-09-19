import { LoaderCircle } from "lucide-react";

type ButtonLoadingContentProps = {
  message: string;
};

export default function ButtonLoadingContent({
  message,
}: ButtonLoadingContentProps) {
  return (
    <span
      role="status"
      aria-live="polite"
      className="inline-flex items-center justify-center gap-2"
    >
      <LoaderCircle
        size={16}
        aria-hidden="true"
        className="shrink-0 motion-safe:animate-spin"
      />

      <span>{message}</span>
    </span>
  );
}
