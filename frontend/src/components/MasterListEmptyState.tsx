import type { LucideIcon } from "lucide-react";

type MasterListEmptyStateProps = {
  icon: LucideIcon;
  title: string;
  description: string;
};

export default function MasterListEmptyState({
  icon: Icon,
  title,
  description,
}: MasterListEmptyStateProps) {
  return (
    <div className="flex h-[210px] flex-col items-center justify-center px-6 text-center">
      <div className="mb-4 rounded-full bg-slate-100 p-4">
        <Icon size={28} className="text-slate-400" />
      </div>

      <h3 className="text-base font-semibold text-slate-900">{title}</h3>

      <p className="mt-1 text-sm text-slate-500">{description}</p>
    </div>
  );
}
