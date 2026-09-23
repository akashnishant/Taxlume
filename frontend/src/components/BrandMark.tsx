type BrandMarkProps = {
  className?: string;
};

// Matches the mark used on the Techabanca company website.
export default function BrandMark({ className = "h-10 w-10" }: BrandMarkProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 64 64"
      aria-hidden="true"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect width="64" height="64" rx="13" fill="#0b1115" />
      <path d="M13 18h38v8H36v24h-9V26H13z" fill="#e9f4f2" />
      <circle cx="48" cy="46" r="5" fill="#b4ee5e" />
    </svg>
  );
}
