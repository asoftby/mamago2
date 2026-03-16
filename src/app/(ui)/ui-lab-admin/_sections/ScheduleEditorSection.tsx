"use client";

import { useState } from "react";
import { SectionWrapper } from "../_components/SectionWrapper";
import { ScheduleEditor } from "@/components/schedule-editor/ScheduleEditor";
import { mockScheduleData } from "@/components/schedule-editor/mockData";
import type { ScheduleEditorValue } from "@/components/schedule-editor/types";

export function ScheduleEditorSection() {
  const [scheduleValue, setScheduleValue] = useState<ScheduleEditorValue>(mockScheduleData);

  return (
    <SectionWrapper
      id="schedule-editor"
      title="Schedule Editor"
      description="UX-first конструктор расписания для услуг, занятий и курсов"
    >
      {/* Introduction */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <h3 className="text-base font-semibold text-blue-900 mb-3">О модуле</h3>
        <div className="space-y-2 text-sm text-blue-900">
          <p>
            Современный редактор расписания для создания и управления датами и слотами. 
            Не CRM-таблица, а понятный конструктор для бизнеса.
          </p>
          <p className="font-medium mt-3">Основные возможности:</p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li>Добавление дат через календарь</li>
            <li>Создание и редактирование слотов</li>
            <li>Копирование слотов на другие даты</li>
            <li>Удаление слотов</li>
            <li>Адаптивный layout (desktop + mobile)</li>
          </ul>
        </div>
      </div>

      {/* Use Cases */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h3 className="text-base font-semibold text-gray-900 mb-4">Сценарии использования</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <div className="text-sm font-medium text-gray-900">Услуги и занятия</div>
            <p className="text-xs text-gray-600">
              Настройка расписания для пробных занятий, мастер-классов, консультаций
            </p>
          </div>
          <div className="space-y-2">
            <div className="text-sm font-medium text-gray-900">Курсы</div>
            <p className="text-xs text-gray-600">
              Создание расписания для регулярных курсов с несколькими группами
            </p>
          </div>
          <div className="space-y-2">
            <div className="text-sm font-medium text-gray-900">События</div>
            <p className="text-xs text-gray-600">
              Управление датами и временем для событий с несколькими сеансами
            </p>
          </div>
          <div className="space-y-2">
            <div className="text-sm font-medium text-gray-900">Запись по слотам</div>
            <p className="text-xs text-gray-600">
              Организация записи клиентов на конкретные временные слоты
            </p>
          </div>
        </div>
      </div>

      {/* Interactive Demo */}
      <div>
        <div className="mb-4">
          <h3 className="text-base font-semibold text-gray-900">Интерактивное демо</h3>
          <p className="text-sm text-gray-600 mt-1">
            Попробуйте добавить даты, создать слоты и скопировать их на другие даты
          </p>
        </div>
        <ScheduleEditor value={scheduleValue} onChange={setScheduleValue} />
      </div>

      {/* Layout Explanation */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h3 className="text-base font-semibold text-gray-900 mb-4">Layout Structure</h3>
        <div className="space-y-4 text-sm text-gray-700">
          <div>
            <div className="font-medium text-gray-900 mb-2">Desktop (2-колоночный):</div>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>Слева: список дат с количеством слотов</li>
              <li>Справа: слоты выбранной даты</li>
              <li>Активная дата визуально выделена</li>
              <li>Кнопка "Скопировать слоты" доступна при наличии слотов</li>
            </ul>
          </div>
          <div>
            <div className="font-medium text-gray-900 mb-2">Mobile (вертикальный):</div>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>Сверху: горизонтальный скролл дат (chips)</li>
              <li>Ниже: слоты выбранной даты</li>
              <li>Компактные кнопки действий</li>
              <li>Touch-friendly интерфейс</li>
            </ul>
          </div>
        </div>
      </div>

      {/* UX Principles */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
        <h3 className="text-base font-semibold text-gray-900 mb-4">UX Principles</h3>
        <div className="space-y-3 text-sm text-gray-700">
          <div className="flex gap-3">
            <div className="flex-shrink-0 w-6 h-6 rounded-full bg-green-100 text-green-700 flex items-center justify-center text-xs font-bold">
              ✓
            </div>
            <div>
              <div className="font-medium text-gray-900">Понятная иерархия</div>
              <div className="text-xs text-gray-600 mt-0.5">
                Сначала выбор даты, потом работа со слотами
              </div>
            </div>
          </div>
          <div className="flex gap-3">
            <div className="flex-shrink-0 w-6 h-6 rounded-full bg-green-100 text-green-700 flex items-center justify-center text-xs font-bold">
              ✓
            </div>
            <div>
              <div className="font-medium text-gray-900">Быстрые действия</div>
              <div className="text-xs text-gray-600 mt-0.5">
                Копирование слотов на несколько дат одним кликом
              </div>
            </div>
          </div>
          <div className="flex gap-3">
            <div className="flex-shrink-0 w-6 h-6 rounded-full bg-green-100 text-green-700 flex items-center justify-center text-xs font-bold">
              ✓
            </div>
            <div>
              <div className="font-medium text-gray-900">Empty states</div>
              <div className="text-xs text-gray-600 mt-0.5">
                Понятные подсказки когда нет дат или слотов
              </div>
            </div>
          </div>
          <div className="flex gap-3">
            <div className="flex-shrink-0 w-6 h-6 rounded-full bg-green-100 text-green-700 flex items-center justify-center text-xs font-bold">
              ✓
            </div>
            <div>
              <div className="font-medium text-gray-900">Компактные формы</div>
              <div className="text-xs text-gray-600 mt-0.5">
                Минимум полей, только необходимое
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Technical Notes */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h3 className="text-base font-semibold text-gray-900 mb-4">Technical Notes</h3>
        <div className="space-y-4 text-sm text-gray-700">
          <div>
            <div className="font-medium text-gray-900 mb-1">Component Structure:</div>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li><code className="text-xs bg-white px-1 py-0.5 rounded border">ScheduleEditor</code> - Main container with state management</li>
              <li><code className="text-xs bg-white px-1 py-0.5 rounded border">ScheduleDateItem</code> - Date selector item</li>
              <li><code className="text-xs bg-white px-1 py-0.5 rounded border">SlotCard</code> - Individual slot display</li>
              <li><code className="text-xs bg-white px-1 py-0.5 rounded border">SlotFormDialog</code> - Add/edit slot form</li>
              <li><code className="text-xs bg-white px-1 py-0.5 rounded border">CopySlotsDialog</code> - Copy slots to dates</li>
            </ul>
          </div>

          <div>
            <div className="font-medium text-gray-900 mb-1">State Management:</div>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>Controlled component with value/onChange props</li>
              <li>Local state for UI (dialogs, selected date)</li>
              <li>Automatic sorting of dates and slots</li>
              <li>Unique ID generation for new items</li>
            </ul>
          </div>

          <div>
            <div className="font-medium text-gray-900 mb-1">Key Features:</div>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>Calendar integration for date selection</li>
              <li>Past dates disabled automatically</li>
              <li>Duplicate date prevention</li>
              <li>Slot copying with new IDs (append mode)</li>
              <li>Inline edit/delete actions</li>
            </ul>
          </div>
        </div>
      </div>
    </SectionWrapper>
  );
}
