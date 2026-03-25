import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type SeoStatusBadgeVariant =
  | "success"
  | "warning"
  | "neutral"
  | "muted"
  | "danger";

const variantClass: Record<SeoStatusBadgeVariant, string> = {
  success:
    "border-emerald-200 bg-emerald-50 text-emerald-900 hover:bg-emerald-50/90",
  warning:
    "border-amber-200 bg-amber-50 text-amber-950 hover:bg-amber-50/90",
  neutral: "border-slate-200 bg-slate-50 text-slate-900 hover:bg-slate-50/90",
  muted: "border-gray-200 bg-gray-100 text-gray-700 hover:bg-gray-100/90",
  danger: "border-red-200 bg-red-50 text-red-900 hover:bg-red-50/90",
};

export interface SeoStatusBadgeProps {
  children: React.ReactNode;
  variant?: SeoStatusBadgeVariant;
  className?: string;
}

export function SeoStatusBadge({
  children,
  variant = "neutral",
  className,
}: SeoStatusBadgeProps) {
  return (
    <Badge
      variant="outline"
      className={cn("font-normal", variantClass[variant], className)}
    >
      {children}
    </Badge>
  );
}
