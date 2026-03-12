"use client";

import { Calendar, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { WhenSelect } from "@/components/ui/when-select";
import { useFilterUpdater } from "./filterUtils";

interface DatePanelProps {
  onClose: () => void;
  applied: any;
  actions: any;
}

export function DatePanel({ onClose, applied, actions }: DatePanelProps) {
  const { updateFilters } = useFilterUpdater();
  
  const handleWhenChange = (val: any) => {
    let patch: any = {};
    if (!val) {
      patch = { dateFrom: null, dateTo: null, whenPreset: null };
    } else if (typeof val === 'string') {
      if (val === 'today') {
        patch = { whenPreset: "TODAY", dateFrom: null, dateTo: null };
      } else if (val === 'tomorrow') {
        patch = { whenPreset: "TOMORROW", dateFrom: null, dateTo: null };
      } else if (val === 'weekend') {
        patch = { whenPreset: "WEEKEND", dateFrom: null, dateTo: null };
      } else {
        patch = { whenPreset: null, dateFrom: val, dateTo: null };
      }
    } else if (val instanceof Date) {
      patch = { whenPreset: null, dateFrom: val.toISOString().split('T')[0], dateTo: null };
    } else if ('from' in val) {
      patch = { 
        whenPreset: null,
        dateFrom: val.from.toISOString().split('T')[0], 
        dateTo: val.to.toISOString().split('T')[0] 
      };
    }
    
    updateFilters(patch);
    onClose();
  };

  // Prepare value for WhenSelect
  const whenValue = (() => {
    if (applied.whenPreset === "TODAY") return "today";
    if (applied.whenPreset === "TOMORROW") return "tomorrow";
    if (applied.whenPreset === "WEEKEND") return "weekend";
    if (!applied.dateFrom) return null;
    try {
      const fromDate = new Date(applied.dateFrom);
      if (isNaN(fromDate.getTime())) return null;
      if (applied.dateTo) {
        const toDate = new Date(applied.dateTo);
        if (isNaN(toDate.getTime())) return fromDate;
        return { from: fromDate, to: toDate };
      }
      return fromDate;
    } catch {
      return null;
    }
  })();

  const quickOptions = [
    { id: "today", label: "Сегодня", value: "today" },
    { id: "tomorrow", label: "Завтра", value: "tomorrow" },
    { id: "weekend", label: "Выходные", value: "weekend" },
  ];

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-lg overflow-hidden">
      <div className="p-6">
        {/* Quick Options */}
        <div className="mb-6">
          <h3 className="text-sm font-medium text-gray-900 mb-3">Быстрый выбор</h3>
          <div className="grid grid-cols-3 gap-3">
            {quickOptions.map((option) => (
              <button
                key={option.id}
                onClick={() => handleWhenChange(option.value)}
                className={cn(
                  "flex flex-col items-center gap-2 p-4 rounded-xl border transition-colors",
                  applied.whenPreset === option.id.toUpperCase()
                    ? "border-[#EF8759] bg-[#EF8759]/5 text-[#EF8759]"
                    : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                )}
              >
                <Clock className="h-5 w-5" />
                <span className="text-sm font-medium">{option.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Calendar */}
        <div>
          <h3 className="text-sm font-medium text-gray-900 mb-3">Выбрать дату</h3>
          <div className="border border-gray-200 rounded-xl overflow-hidden">
            <WhenSelect
              value={whenValue}
              onChange={handleWhenChange}
              uiMode="desktop"
              label=""
              className="border-0 rounded-none"
              variant="embedded"
            />
          </div>
        </div>
      </div>
    </div>
  );
}