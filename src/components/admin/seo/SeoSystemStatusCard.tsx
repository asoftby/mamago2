import { CheckCircle2, AlertCircle, CircleDashed } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SeoSystemStatusLevel } from "@/lib/admin/seo/domain/types";

interface SeoSystemStatusCardProps {
  title: string;
  level: SeoSystemStatusLevel;
  description: string;
}

const levelConfig: Record<
  SeoSystemStatusLevel,
  { label: string; className: string; Icon: typeof CheckCircle2 }
> = {
  ok: {
    label: "OK",
    className: "border-emerald-200 bg-emerald-50/80 text-emerald-800",
    Icon: CheckCircle2,
  },
  warning: {
    label: "Warning",
    className: "border-amber-200 bg-amber-50/80 text-amber-900",
    Icon: AlertCircle,
  },
  empty: {
    label: "Empty",
    className: "border-gray-200 bg-gray-50 text-gray-600",
    Icon: CircleDashed,
  },
};

export function SeoSystemStatusCard({
  title,
  level,
  description,
}: SeoSystemStatusCardProps) {
  const cfg = levelConfig[level];
  const Icon = cfg.Icon;

  return (
    <div
      className={cn(
        "flex flex-col rounded-xl border p-4 shadow-sm",
        cfg.className,
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">{title}</h3>
        <span
          className={cn(
            "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
            level === "ok" && "bg-emerald-100 text-emerald-800",
            level === "warning" && "bg-amber-100 text-amber-900",
            level === "empty" && "bg-white/80 text-gray-600",
          )}
        >
          <Icon className="h-3 w-3" aria-hidden />
          {cfg.label}
        </span>
      </div>
      <p className="mt-2 text-xs leading-relaxed opacity-90">{description}</p>
    </div>
  );
}
