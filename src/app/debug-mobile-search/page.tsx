"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { useDiscoveryFilters } from "@/features/filters/discovery/filters.store";
import { useDiscoveryFilterOptions } from "@/features/filters/discovery/filters.api";
import { AGE_GROUPS } from "@/features/filters/age/ageGroups";

function DebugContent() {
  const searchParams = useSearchParams();
  const { applied } = useDiscoveryFilters();
  const { options: apiOptions } = useDiscoveryFilterOptions("minsk");

  // Build location text (same logic as MobileSearchEntry)
  const getLocationText = () => {
    if (applied.district && apiOptions) {
      const district = apiOptions.districts.find(d => d.value === applied.district);
      return district?.label || applied.district;
    }
    if (applied.metro && apiOptions) {
      const metro = apiOptions.metros.find(m => m.value === applied.metro);
      return metro?.label || applied.metro;
    }
    return "Минск";
  };

  // Build date text
  const getDateText = () => {
    if (applied.whenPreset === "TODAY") return "Сегодня";
    if (applied.whenPreset === "TOMORROW") return "Завтра";
    if (applied.whenPreset === "WEEKEND") return "Выходные";
    
    if (applied.dateFrom) {
      const fromDate = new Date(applied.dateFrom);
      const day = fromDate.getDate();
      const month = ["янв", "фев", "мар", "апр", "май", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"][fromDate.getMonth()];
      return `${day} ${month}`;
    }
    
    return null;
  };

  // Build age text
  const getAgeText = () => {
    if (applied.age.length === 0) return null;
    
    const ageLabels = applied.age.map(ageValue => {
      const group = AGE_GROUPS.find(g => g.value === ageValue);
      return group ? group.label : ageValue;
    });
    
    if (ageLabels.length === 1) return ageLabels[0];
    if (ageLabels.length === 2) return `${ageLabels[0]}, ${ageLabels[1]}`;
    return `${ageLabels[0]} +${ageLabels.length - 1}`;
  };

  const locationText = getLocationText();
  const dateText = getDateText();
  const ageText = getAgeText();
  
  const parts = [locationText, dateText, ageText].filter(Boolean);
  const summaryText = parts.length > 0 ? parts.join(" • ") : "Начать поиск";
  const hasAdditionalFilters = applied.district || applied.metro || applied.dateFrom || applied.whenPreset || applied.age.length > 0;

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">🔍 Диагностика мобильного поиска</h1>
      
      <div className="space-y-6">
        <div className="bg-gray-100 p-4 rounded-lg">
          <h2 className="font-semibold mb-2">URL параметры:</h2>
          <pre className="text-sm">{searchParams.toString() || "(нет параметров)"}</pre>
        </div>

        <div className="bg-blue-100 p-4 rounded-lg">
          <h2 className="font-semibold mb-2">Применённые фильтры (applied):</h2>
          <pre className="text-sm">{JSON.stringify(applied, null, 2)}</pre>
        </div>

        <div className="bg-green-100 p-4 rounded-lg">
          <h2 className="font-semibold mb-2">API опции загружены:</h2>
          <p>Метро: {apiOptions?.metros?.length || 0} станций</p>
          <p>Районы: {apiOptions?.districts?.length || 0} районов</p>
          {apiOptions?.metros?.slice(0, 3).map(metro => (
            <p key={metro.id} className="text-xs">- {metro.label} ({metro.value})</p>
          ))}
        </div>

        <div className="bg-yellow-100 p-4 rounded-lg">
          <h2 className="font-semibold mb-2">Текст для отображения:</h2>
          <p><strong>Локация:</strong> {locationText}</p>
          <p><strong>Дата:</strong> {dateText || "(не выбрана)"}</p>
          <p><strong>Возраст:</strong> {ageText || "(не выбран)"}</p>
          <p><strong>Итоговый текст:</strong> &quot;{summaryText}&quot;</p>
          <p><strong>Есть дополнительные фильтры:</strong> {hasAdditionalFilters ? "ДА" : "НЕТ"}</p>
        </div>

        <div className="bg-purple-100 p-4 rounded-lg">
          <h2 className="font-semibold mb-2">Тестовые ссылки:</h2>
          <div className="space-y-2">
            <Link href="/debug-mobile-search" className="block text-blue-600 hover:underline">
              Без фильтров
            </Link>
            <Link href="/debug-mobile-search?age=0-1" className="block text-blue-600 hover:underline">
              С возрастом 0-1 год
            </Link>
            <Link href="/debug-mobile-search?preset=TODAY" className="block text-blue-600 hover:underline">
              Сегодня
            </Link>
            <Link href="/debug-mobile-search?metro=cmmj6x1s5000hws428w3qtxqy" className="block text-blue-600 hover:underline">
              С метро
            </Link>
            <Link href="/debug-mobile-search?age=0-1,1-3&preset=TOMORROW" className="block text-blue-600 hover:underline">
              Несколько фильтров
            </Link>
          </div>
        </div>

        <div className="bg-red-100 p-4 rounded-lg">
          <h2 className="font-semibold mb-2">Симуляция MobileSearchEntry:</h2>
          <div className="border border-gray-300 rounded-full p-4 bg-white flex items-center gap-3 relative">
            <div className="w-5 h-5 bg-gray-300 rounded-full"></div>
            <span className={hasAdditionalFilters ? "text-gray-700" : "text-gray-500"}>
              {summaryText}
            </span>
            <div className="absolute top-0 right-0 bg-red-500 text-white text-xs p-1 rounded">
              {hasAdditionalFilters ? 'HAS' : 'NO'} filters
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
export default function DebugMobileSearchPage() {
  return (
    <Suspense fallback={<div className="p-8">Loading debug info...</div>}>
      <DebugContent />
    </Suspense>
  );
}