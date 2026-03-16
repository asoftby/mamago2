"use client";

import { useState } from "react";
import { EventScheduleList } from "@/components/admin/event-schedule/EventScheduleList";
import type { EventScheduleItem } from "@/components/admin/event-schedule/types";
import { ComponentMetaCard } from "@/components/ui-lab/ComponentMetaCard";
import { getComponentMeta } from "@/components/ui-lab/registry";

// Demo data
const initialSingleEvent: EventScheduleItem[] = [
  {
    id: "demo-1",
    isMultiDay: false,
    date: null,
    allDay: false,
    startTime: "10:00",
    endTime: "18:00",
    recurringEnabled: false,
    recurrenceInterval: 1,
    recurrenceUnit: "week",
    recurrenceUntil: null,
    isCollapsed: false,
  },
];

const initialRecurringEvent: EventScheduleItem[] = [
  {
    id: "demo-2",
    isMultiDay: false,
    date: null,
    allDay: false,
    startTime: "14:00",
    endTime: "16:00",
    recurringEnabled: true,
    recurrenceInterval: 2,
    recurrenceUnit: "week",
    recurrenceUntil: null,
    isCollapsed: false,
  },
];

const initialMultipleDates: EventScheduleItem[] = [
  {
    id: "demo-3",
    isMultiDay: false,
    date: null,
    allDay: false,
    startTime: "10:00",
    endTime: "12:00",
    recurringEnabled: false,
    recurrenceInterval: 1,
    recurrenceUnit: "day",
    recurrenceUntil: null,
    isCollapsed: false,
  },
  {
    id: "demo-4",
    isMultiDay: false,
    date: null,
    allDay: true,
    startTime: "10:00",
    endTime: "18:00",
    recurringEnabled: false,
    recurrenceInterval: 1,
    recurrenceUnit: "day",
    recurrenceUntil: null,
    isCollapsed: false,
  },
];

export function EventScheduleSection() {
  const [singleEvent, setSingleEvent] = useState<EventScheduleItem[]>(initialSingleEvent);
  const [recurringEvent, setRecurringEvent] = useState<EventScheduleItem[]>(initialRecurringEvent);
  const [multipleDates, setMultipleDates] = useState<EventScheduleItem[]>(initialMultipleDates);

  const componentMeta = getComponentMeta("event-schedule-module", "admin");

  return (
    <div className="space-y-12">
      {/* Component Metadata */}
      {componentMeta && (
        <ComponentMetaCard {...componentMeta}>
          <div className="space-y-8">
            {/* Section Header */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Demo States</h3>
              <p className="text-sm text-gray-600">
                Переиспользуемый компонент для ввода дат проведения события
              </p>
            </div>

      {/* State 1: Single Event */}
      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-1">
            Состояние 1: Обычное событие
          </h3>
          <p className="text-sm text-gray-600">
            Одна дата, без повторения
          </p>
        </div>
        <div className="bg-gray-50 rounded-xl p-6">
          <EventScheduleList items={singleEvent} onChange={setSingleEvent} />
        </div>
      </div>

      {/* State 2: Recurring Event */}
      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-1">
            Состояние 2: Повторяющееся событие
          </h3>
          <p className="text-sm text-gray-600">
            Одна дата с включенным recurring
          </p>
        </div>
        <div className="bg-gray-50 rounded-xl p-6">
          <EventScheduleList items={recurringEvent} onChange={setRecurringEvent} />
        </div>
      </div>

      {/* State 3: Multiple Dates */}
      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-1">
            Состояние 3: Несколько дат
          </h3>
          <p className="text-sm text-gray-600">
            Две карточки с разными датами
          </p>
        </div>
        <div className="bg-gray-50 rounded-xl p-6">
          <EventScheduleList items={multipleDates} onChange={setMultipleDates} />
        </div>
      </div>

      {/* Integration Guide */}
      <div className="border-t border-gray-200 pt-8">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Интеграция в Event Wizard
        </h3>
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 space-y-3">
          <p className="text-sm text-blue-900">
            <strong>Шаг 1:</strong> Импортировать EventScheduleList в Step4DateTime
          </p>
          <p className="text-sm text-blue-900">
            <strong>Шаг 2:</strong> Преобразовать EventScheduleItem[] в EventFormData.dates
          </p>
          <p className="text-sm text-blue-900">
            <strong>Шаг 3:</strong> Добавить валидацию для дат
          </p>
          <p className="text-sm text-blue-900">
            <strong>Шаг 4:</strong> Сохранять в scheduleJson для recurring events
          </p>
        </div>
      </div>

            {/* Component API */}
            <div className="border-t border-gray-200 pt-8">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Component API
              </h3>
              <div className="bg-gray-50 rounded-lg p-6">
                <pre className="text-xs text-gray-800 overflow-x-auto">
{`// EventScheduleList Props
interface EventScheduleListProps {
  items: EventScheduleItem[];
  onChange: (items: EventScheduleItem[]) => void;
}

// EventScheduleItem Type
interface EventScheduleItem {
  id: string;
  isMultiDay: boolean;
  date: string | null;
  allDay: boolean;
  startTime: string;
  endTime: string;
  recurringEnabled: boolean;
  recurrenceInterval: number;
  recurrenceUnit: "day" | "week" | "month" | "year";
  recurrenceUntil: string | null;
  isCollapsed?: boolean;
}`}
                </pre>
              </div>
            </div>
          </div>
        </ComponentMetaCard>
      )}
    </div>
  );
}
