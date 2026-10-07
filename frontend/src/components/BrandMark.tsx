type BrandMarkProps = {
  className?: string;
};

export default function BrandMark({
  className = "h-[34px] w-[34px]",
}: BrandMarkProps) {
  return (
    <span
      aria-hidden="true"
      className={`relative inline-block shrink-0 rotate-45 rounded-[12%] border border-[#BAF16D] ${className}`}
    >
      <span
        className="absolute bg-[#BAF16D]"
        style={{
          left: "20.588%",
          top: "29.412%",
          width: "47.059%",
          height: "5.882%",
        }}
      />
      <span
        className="absolute bg-[#BAF16D]"
        style={{
          left: "41.176%",
          top: "29.412%",
          width: "5.882%",
          height: "47.059%",
        }}
      />
      <span
        className="absolute rounded-full bg-[#BAF16D]"
        style={{
          right: "8.824%",
          bottom: "8.824%",
          width: "17.647%",
          height: "17.647%",
        }}
      />
    </span>
  );
}
