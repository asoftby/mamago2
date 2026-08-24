"use client";

import { cn } from "@/lib/utils";
import { WhenSelect } from "@/components/ui/when-select";
import type { DiscoveryFilters } from "@/features/filters/discovery/filters.store";

// Helper function to convert Date to YYYY-MM-DD in local timezone
function formatDateToLocal(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

type RangeValue = { from: Date; to: Date };
type WhenValue = string | Date | RangeValue | null;
type FilterPatch = Partial<DiscoveryFilters>;

interface DatePanelProps {
  onClose: () => void;
  applied: DiscoveryFilters;
  actions: { setDraft: (patch: FilterPatch) => void };
  /** Мобильный sheet: фон как у хедера, без отдельной белой карточки */
  embedded?: boolean;
}

export function DatePanel({ onClose, applied, actions, embedded = false }: DatePanelProps) {
  const handleWhenChange = (val: WhenValue) => {
    let patch: FilterPatch = {};
    if (!val) {
      patch = { dateFrom: null, dateTo: null, whenPreset: null };
    } else if (typeof val === 'string') {
      if (val === 'today') {
        // Если уже выбрано "Сегодня", отжимаем кнопку
        if (applied.whenPreset === "TODAY") {
          patch = { dateFrom: null, dateTo: null, whenPreset: null };
        } else {
          patch = { whenPreset: "TODAY", dateFrom: null, dateTo: null };
        }
      } else if (val === 'tomorrow') {
        // Если уже выбрано "Завтра", отжимаем кнопку
        if (applied.whenPreset === "TOMORROW") {
          patch = { dateFrom: null, dateTo: null, whenPreset: null };
        } else {
          patch = { whenPreset: "TOMORROW", dateFrom: null, dateTo: null };
        }
      } else if (val === 'weekend') {
        // Если уже выбрано "На выходных", отжимаем кнопку
        if (applied.whenPreset === "WEEKEND") {
          patch = { dateFrom: null, dateTo: null, whenPreset: null };
        } else {
          patch = { whenPreset: "WEEKEND", dateFrom: null, dateTo: null };
        }
      } else {
        patch = { whenPreset: null, dateFrom: val, dateTo: null };
      }
    } else if (val instanceof Date) {
      // Проверяем, соответствует ли выбранная дата пресетам
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
      
      if (val.getTime() === today.getTime()) {
        patch = { whenPreset: "TODAY", dateFrom: null, dateTo: null };
      } else if (val.getTime() === tomorrow.getTime()) {
        patch = { whenPreset: "TOMORROW", dateFrom: null, dateTo: null };
      } else {
        patch = { whenPreset: null, dateFrom: formatDateToLocal(val), dateTo: null };
      }
    } else if (val !== null && typeof val === 'object' && 'from' in val) {
      const rangeVal = val as RangeValue;
      // Проверяем, соответствует ли выбранный интервал выходным
      const now = new Date();
      const day = now.getDay() === 0 ? 7 : now.getDay();
      const saturday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + (6 - day));
      const sunday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + (7 - day));
      
      if (rangeVal.from.getTime() === saturday.getTime() && rangeVal.to.getTime() === sunday.getTime()) {
        patch = { whenPreset: "WEEKEND", dateFrom: null, dateTo: null };
      } else {
        patch = { 
          whenPreset: null,
          dateFrom: formatDateToLocal(rangeVal.from), 
          dateTo: formatDateToLocal(rangeVal.to) 
        };
      }
    }
    
    // Always use setDraft from actions (works for both desktop and mobile)
    actions.setDraft(patch);
    
    // Не закрываем панель автоматически - пользователь может выбрать другие параметры
    // onClose();
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
    <div
      className={cn(
        "overflow-hidden rounded-2xl",
        embedded
          ? "bg-[#F6F2EA]"
          : "border border-gray-200 bg-white shadow-lg",
      )}
    >
      <div className={embedded ? "space-y-3 p-4" : "p-6"}>
        {/* Quick Options - без заголовка и иконок */}
        <div className={cn(embedded ? "p-0" : "mb-6")}>
          <div className="grid grid-cols-3 gap-3">
            {quickOptions.map((option) => (
              <button
                key={option.id}
                onClick={() => handleWhenChange(option.value)}
                className={cn(
                  "flex items-center justify-center p-3 rounded-xl border transition-colors text-sm font-medium",
                  applied.whenPreset === option.id.toUpperCase()
                    ? "border-[#EF8759] bg-[#EF8759]/5 text-[#EF8759]"
                    : embedded
                      ? "border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50"
                      : "border-gray-200 hover:border-gray-300 hover:bg-gray-50",
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        {/* Calendar - без границы */}
        <div className={cn(embedded && "rounded-xl bg-white p-3")}>
          <WhenSelect
            value={whenValue}
            onChange={handleWhenChange}
            uiMode="desktop"
            label=""
            className="border-0"
            variant="embedded"
          />
        </div>
      </div>
    </div>
  );
}
