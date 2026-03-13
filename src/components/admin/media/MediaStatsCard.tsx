import { LucideIcon } from "lucide-react";

interface MediaStatsCardProps {
  icon: LucideIcon;
  label: string;
  value: number;
  alert?: boolean;
}

export function MediaStatsCard({ icon: Icon, label, value, alert }: MediaStatsCardProps) {
  return (
    <div className="bg-white rounded-lg shadow p-4">
      <div className="flex items-center gap-2 mb-2">
        <Icon className={`w-4 h-4 ${alert ? "text-orange-600" : "text-gray-600"}`} />
        <p className="text-sm text-gray-600">{label}</p>
      </div>
      <p className={`text-2xl font-bold ${alert ? "text-orange-600" : "text-gray-900"}`}>
        {value}
      </p>
    </div>
  );
}
