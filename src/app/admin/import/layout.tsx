import React from "react";
import { AdminSectionTabs } from "@/components/admin/AdminSectionTabs";
import { IMPORT_SECTION_NAV_CONFIG } from "@/lib/admin/importSectionNavConfig";

export default function ImportLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-full bg-gray-50">
      <div className="border-b border-gray-200 bg-gradient-to-r from-amber-50 via-white to-sky-50">
        <div className="mx-auto max-w-7xl px-6 py-5">
          <div className="flex flex-col gap-2">
            <div>
              <h1 className="text-2xl font-semibold text-gray-950">Импорт</h1>
              <p className="mt-1 max-w-4xl text-sm text-gray-600">
                Раздел разделён на четыре этапа: источник, прогон, импортированные объекты и итоговые сущности каталога.
                Импортированный объект всегда остаётся отдельной промежуточной записью, пока вы не создадите или не свяжете Place/Event.
              </p>
            </div>
            <div className="flex flex-wrap gap-2 text-xs text-gray-600">
              <span className="rounded-full bg-white/90 px-3 py-1 ring-1 ring-gray-200">1. Настроить источник</span>
              <span className="rounded-full bg-white/90 px-3 py-1 ring-1 ring-gray-200">2. Запустить импорт</span>
              <span className="rounded-full bg-white/90 px-3 py-1 ring-1 ring-gray-200">3. Разобрать импортированные объекты</span>
              <span className="rounded-full bg-white/90 px-3 py-1 ring-1 ring-gray-200">4. Создать или связать Place/Event</span>
            </div>
          </div>
        </div>
      </div>
      <AdminSectionTabs config={IMPORT_SECTION_NAV_CONFIG} />
      <div className="mx-auto max-w-7xl">{children}</div>
    </div>
  );
}
