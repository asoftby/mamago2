import { LucideIcon } from "lucide-react";

interface CommercialKpiCardProps {
  icon: LucideIcon;
  label: string;
  value: string | number;
  subtitle?: string;
  alert?: boolean;
}

export function CommercialKpiCard({
  icon: Icon,
  label,
  value,
  subtitle,
  alert = false,
}: CommercialKpiCardProps) {
  return (
    <div className={`bg-white rounded-lg shadow p-4 ${alert ? "border-2 border-orange-300" : ""}`}>
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-lg ${alert ? "bg-orange-100" : "bg-blue-100"}`}>
          <Icon className={`w-5 h-5 ${alert ? "text-orange-600" : "text-blue-600"}`} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs text-gray-600 truncate">{label}</p>
          <p className={`text-xl font-semibold ${alert ? "text-orange-600" : "text-gray-900"}`}>
            {value}
          </p>
          {subtitle && <p className="text-xs text-gray-500">{subtitle}</p>}
        </div>
      </div>
    </div>
  );
}
