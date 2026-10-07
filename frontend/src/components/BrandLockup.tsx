import BrandMark from "./BrandMark";

type BrandLockupProps = {
  variant?: "light" | "dark";
  size?: "sm" | "md" | "lg";
  className?: string;
};

const sizes = {
  sm: {
    mark: "h-[28px] w-[28px]",
    gap: "gap-3",
    wordmark: "text-[17px]",
    product: "text-[8px]",
  },
  md: {
    mark: "h-[34px] w-[34px]",
    gap: "gap-[14px]",
    wordmark: "text-[20px]",
    product: "text-[9px]",
  },
  lg: {
    mark: "h-[40px] w-[40px]",
    gap: "gap-4",
    wordmark: "text-[24px]",
    product: "text-[10px]",
  },
} as const;

export default function BrandLockup({
  variant = "light",
  size = "md",
  className = "",
}: BrandLockupProps) {
  const scale = sizes[size];

  const wordmarkColor =
    variant === "dark" ? "text-[#EEF4F1]" : "text-[#081014]";

  const productColor =
    variant === "dark" ? "text-white/55" : "text-[#637077]";

  return (
    <span
      className={`inline-flex items-center whitespace-nowrap ${scale.gap} ${className}`}
    >
      <BrandMark className={scale.mark} />

      <span className="flex flex-col gap-1">
        <span
          className={`${scale.wordmark} font-extrabold leading-none tracking-[-0.055em] ${wordmarkColor}`}
        >
          TECHABANCA
          <span className="text-[#BAF16D]">.</span>
        </span>

        <span
          className={`${scale.product} font-bold uppercase leading-none tracking-[0.18em] ${productColor}`}
        >
          BILLING
        </span>
      </span>
    </span>
  );
}
