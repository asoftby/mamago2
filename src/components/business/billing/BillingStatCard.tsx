import { LucideIcon } from "lucide-react";

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
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <div className="flex items-start justify-between mb-3">
        <div className="w-10 h-10 rounded-lg bg-gray-50 flex items-center justify-center">
          <Icon className="w-5 h-5 text-gray-600" />
        </div>
        {trend && (
          <span className={`text-xs font-medium ${trend.positive ? "text-green-600" : "text-red-600"}`}>
            {trend.value}
          </span>
        )}
      </div>
      
      <div>
        <p className="text-sm text-gray-600 mb-1">{label}</p>
        <p className="text-2xl font-bold text-gray-900">{value}</p>
        {subtitle && (
          <p className="text-xs text-gray-500 mt-1">{subtitle}</p>
        )}
      </div>
    </div>
  );
}
