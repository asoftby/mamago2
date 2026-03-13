import { LucideIcon } from "lucide-react";

interface BillingKpiCardProps {
  icon: LucideIcon;
  label: string;
  value: string | number;
  subtitle?: string;
  trend?: {
    value: string;
    positive: boolean;
  };
  alert?: boolean;
}

export function BillingKpiCard({ icon: Icon, label, value, subtitle, trend, alert }: BillingKpiCardProps) {
  return (
    <div className={`bg-white rounded-lg border p-6 ${alert ? "border-orange-200 bg-orange-50" : "border-gray-200"}`}>
      <div className="flex items-start justify-between mb-4">
        <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
          alert ? "bg-orange-100" : "bg-gray-50"
        }`}>
          <Icon className={`w-6 h-6 ${alert ? "text-orange-600" : "text-gray-600"}`} />
        </div>
        {trend && (
          <span className={`text-sm font-medium ${trend.positive ? "text-green-600" : "text-red-600"}`}>
            {trend.value}
          </span>
        )}
      </div>
      
      <div>
        <p className="text-sm text-gray-600 mb-1">{label}</p>
        <p className={`text-3xl font-bold ${alert ? "text-orange-900" : "text-gray-900"}`}>{value}</p>
        {subtitle && (
          <p className="text-sm text-gray-500 mt-1">{subtitle}</p>
        )}
      </div>
    </div>
  );
}
