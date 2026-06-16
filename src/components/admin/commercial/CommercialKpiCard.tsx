import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type Accent = "default" | "green" | "yellow" | "red";

const accentStyles: Record<Accent, { iconWrap: string; icon: string; value: string }> = {
  default: { iconWrap: "bg-blue-50",   icon: "text-blue-600",  value: "text-gray-900" },
  green:   { iconWrap: "bg-green-50",  icon: "text-green-600", value: "text-green-700" },
  yellow:  { iconWrap: "bg-amber-50",  icon: "text-amber-600", value: "text-amber-700" },
  red:     { iconWrap: "bg-red-50",    icon: "text-red-600",   value: "text-red-700" },
};

interface CommercialKpiCardProps {
  icon: LucideIcon;
  label: string;
  value: string | number;
  context?: string;
  accent?: Accent;
}

export function CommercialKpiCard({
  icon: Icon,
  label,
  value,
  context,
  accent = "default",
}: CommercialKpiCardProps) {
  const s = accentStyles[accent];
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <div className="flex items-center gap-1.5 mb-2">
        <div className={cn("p-1 rounded", s.iconWrap)}>
          <Icon className={cn("w-3.5 h-3.5", s.icon)} />
        </div>
        <span className="text-[11px] uppercase tracking-wide font-medium text-gray-500">
          {label}
        </span>
      </div>
      <p className={cn("text-[28px] font-medium leading-none", s.value)}>{value}</p>
      {context && <p className="text-xs text-gray-500 mt-1.5">{context}</p>}
    </div>
  );
}
