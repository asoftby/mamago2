import type { ReactNode } from "react";
import { LucideIcon } from "lucide-react";

interface BillingKpiCardProps {
  icon: LucideIcon;
  label: string;
  value: ReactNode;
  subtitle?: string;
  trend?: {
    value: string;
    positive: boolean;
  };
  alert?: boolean;
}

export function BillingKpiCard({ icon: Icon, label, value, subtitle, trend, alert }: BillingKpiCardProps) {
  return (
    <div
      className={`bg-white rounded-lg border p-3 ${alert ? "border-orange-200 bg-orange-50" : "border-gray-200"}`}
    >
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${
          alert ? "bg-orange-100" : "bg-gray-50"
        }`}>
          <Icon className={`w-[18px] h-[18px] ${alert ? "text-orange-600" : "text-gray-600"}`} />
        </div>
        {trend && (
          <span className={`text-xs font-medium ${trend.positive ? "text-green-600" : "text-red-600"}`}>
            {trend.value}
          </span>
        )}
      </div>
      
      <div>
        <p className="text-xs text-gray-600 leading-snug">{label}</p>
        <p className={`text-xl font-bold ${alert ? "text-orange-900" : "text-gray-900"}`}>{value}</p>
        {subtitle && (
          <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>
        )}
      </div>
    </div>
  );
}
