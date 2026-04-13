import { LucideIcon } from "lucide-react";
import { BusinessSurfaceCard } from "@/components/business/ui/BusinessSurfaceCard";
import { BusinessChip } from "@/components/business/ui/BusinessChip";

interface BillingStatCardProps {
  icon: LucideIcon;
  label: string;
  value: string;
  subtitle?: string;
  trend?: {
    value: string;
    positive: boolean;
  };
}

export function BillingStatCard({ icon: Icon, label, value, subtitle, trend }: BillingStatCardProps) {
  return (
    <BusinessSurfaceCard className="h-full p-4 md:p-5">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-stone-200 bg-stone-50">
          <Icon className="h-5 w-5 text-stone-600" />
        </div>
        {trend && (
          <BusinessChip tone={trend.positive ? "success" : "danger"}>
            {trend.value}
          </BusinessChip>
        )}
      </div>
      
      <div>
        <p className="mb-1 text-sm font-medium text-stone-500">{label}</p>
        <p className="text-2xl font-semibold tracking-tight text-stone-950">{value}</p>
        {subtitle && (
          <p className="mt-2 text-xs leading-6 text-stone-500">{subtitle}</p>
        )}
      </div>
    </BusinessSurfaceCard>
  );
}
