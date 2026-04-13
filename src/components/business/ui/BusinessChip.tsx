import { cn } from "@/lib/utils";

interface BusinessChipProps {
  children: React.ReactNode;
  className?: string;
  tone?:
    | "neutral"
    | "muted"
    | "accent"
    | "success"
    | "warning"
    | "danger";
  size?: "default" | "compact";
}

export function BusinessChip({
  children,
  className,
  tone = "neutral",
  size = "default",
}: BusinessChipProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border font-medium",
        size === "default" && "px-3 py-1.5 text-xs",
        size === "compact" && "px-2.5 py-1 text-[11px] uppercase tracking-[0.16em]",
        tone === "neutral" && "border-stone-200 bg-stone-50 text-stone-600",
        tone === "muted" && "border-stone-200/80 bg-white text-stone-500",
        tone === "accent" && "border-blue-200 bg-blue-50 text-blue-700",
        tone === "success" && "border-emerald-200 bg-emerald-50 text-emerald-700",
        tone === "warning" && "border-amber-200 bg-amber-50 text-amber-800",
        tone === "danger" && "border-red-200 bg-red-50 text-red-700",
        className,
      )}
    >
      {children}
    </span>
  );
}
