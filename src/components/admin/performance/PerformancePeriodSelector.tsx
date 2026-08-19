"use client";

import { useRouter } from "next/navigation";
import { FilterSelect } from "@/components/ui/filter-select";
import type { PerformancePeriod } from "@/lib/performance/performanceMetrics";

export function PerformancePeriodSelector({ value }: { value: PerformancePeriod }) {
  const router = useRouter();
  return (
    <div className="w-full sm:w-44">
      <label htmlFor="performance-period" className="mb-1 block text-xs font-medium text-gray-600">Период</label>
      <FilterSelect
        id="performance-period"
        aria-label="Период"
        value={value}
        options={[
          { value: "today", label: "Сегодня" },
          { value: "7d", label: "7 дней" },
          { value: "30d", label: "30 дней" },
        ]}
        onChange={(period) => router.push(`/admin/performance?period=${period}`)}
      />
    </div>
  );
}
