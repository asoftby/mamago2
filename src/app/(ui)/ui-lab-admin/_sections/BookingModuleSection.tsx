import { SectionWrapper } from "../_components/SectionWrapper";
import { BookingCard } from "@/components/booking/BookingCard";
import { singleEventDemo, multiDateEventDemo, slotsServiceDemo } from "@/components/booking/mockData";

export function BookingModuleSection() {
  return (
    <SectionWrapper
      id="booking-module"
      title="Booking / Sales Module"
      description="Unified booking and sales interface for events, courses, and services"
    >
      {/* Introduction */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <h3 className="text-base font-semibold text-blue-900 mb-3">О модуле</h3>
        <div className="space-y-2 text-sm text-blue-900">
          <p>
            Универсальный модуль для записи на события и продажи услуг. Подходит для интеграции в events, offers, и business flows.
          </p>
          <p className="font-medium mt-3">Ключевые сущности:</p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li>Название услуги/события</li>
            <li>Стоимость</li>
            <li>Дата (одна или несколько)</li>
            <li>Слоты (опционально)</li>
            <li>Availability (есть места / мало / нет)</li>
          </ul>
        </div>
      </div>

      {/* Mode Overview */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h3 className="text-base font-semibold text-gray-900 mb-4">Режимы работы</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <div className="text-sm font-medium text-gray-900">Single Event</div>
            <p className="text-xs text-gray-600">
              Разовое событие с фиксированной датой и временем. Пользователь видит всю информацию сразу.
            </p>
            <div className="text-xs text-gray-500 space-y-1">
              <div>• Одна дата</div>
              <div>• Одно время</div>
              <div>• Простая CTA</div>
            </div>
          </div>

          <div className="space-y-2">
            <div className="text-sm font-medium text-gray-900">Multi Date</div>
            <p className="text-xs text-gray-600">
              Событие с несколькими доступными датами. Пользователь выбирает удобную дату.
            </p>
            <div className="text-xs text-gray-500 space-y-1">
              <div>• Несколько дат</div>
              <div>• Availability по датам</div>
              <div>• Выбор даты → CTA</div>
            </div>
          </div>

          <div className="space-y-2">
            <div className="text-sm font-medium text-gray-900">Slots / Course</div>
            <p className="text-xs text-gray-600">
              Услуга или курс с выбором даты и времени. Самый гибкий режим для расписаний.
            </p>
            <div className="text-xs text-gray-500 space-y-1">
              <div>• Выбор даты</div>
              <div>• Выбор слота</div>
              <div>• Availability по слотам</div>
            </div>
          </div>
        </div>
      </div>

      {/* Demo Cards */}
      <div className="space-y-8">
        {/* Single Event Demo */}
        <div>
          <div className="mb-4">
            <h3 className="text-base font-semibold text-gray-900">Single Event Demo</h3>
            <p className="text-sm text-gray-600 mt-1">
              Разовое событие с фиксированной датой и временем
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Desktop */}
            <div>
              <div className="text-xs font-medium text-gray-500 uppercase mb-3">Desktop</div>
              <BookingCard product={singleEventDemo} />
            </div>
            {/* Mobile */}
            <div>
              <div className="text-xs font-medium text-gray-500 uppercase mb-3">Mobile</div>
              <div className="max-w-sm">
                <BookingCard product={singleEventDemo} />
              </div>
            </div>
          </div>
        </div>

        {/* Multi Date Demo */}
        <div>
          <div className="mb-4">
            <h3 className="text-base font-semibold text-gray-900">Multi Date Demo</h3>
            <p className="text-sm text-gray-600 mt-1">
              Событие с несколькими доступными датами
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Desktop */}
            <div>
              <div className="text-xs font-medium text-gray-500 uppercase mb-3">Desktop</div>
              <BookingCard product={multiDateEventDemo} />
            </div>
            {/* Mobile */}
            <div>
              <div className="text-xs font-medium text-gray-500 uppercase mb-3">Mobile</div>
              <div className="max-w-sm">
                <BookingCard product={multiDateEventDemo} />
              </div>
            </div>
          </div>
        </div>

        {/* Slots Demo */}
        <div>
          <div className="mb-4">
            <h3 className="text-base font-semibold text-gray-900">Slots / Course Demo</h3>
            <p className="text-sm text-gray-600 mt-1">
              Услуга с выбором даты и временного слота
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Desktop */}
            <div>
              <div className="text-xs font-medium text-gray-500 uppercase mb-3">Desktop</div>
              <BookingCard product={slotsServiceDemo} />
            </div>
            {/* Mobile */}
            <div>
              <div className="text-xs font-medium text-gray-500 uppercase mb-3">Mobile</div>
              <div className="max-w-sm">
                <BookingCard product={slotsServiceDemo} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Technical Notes */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
        <h3 className="text-base font-semibold text-gray-900 mb-4">Technical Notes</h3>
        <div className="space-y-4 text-sm text-gray-700">
          <div>
            <div className="font-medium text-gray-900 mb-1">Component Structure:</div>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li><code className="text-xs bg-white px-1 py-0.5 rounded border">BookingCard</code> - Main container component</li>
              <li><code className="text-xs bg-white px-1 py-0.5 rounded border">BookingDateSelector</code> - Date selection UI</li>
              <li><code className="text-xs bg-white px-1 py-0.5 rounded border">BookingSlotSelector</code> - Time slot selection UI</li>
              <li><code className="text-xs bg-white px-1 py-0.5 rounded border">BookingAvailabilityBadge</code> - Availability status display</li>
            </ul>
          </div>

          <div>
            <div className="font-medium text-gray-900 mb-1">State Management:</div>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>Local state with useState for date/slot selection</li>
              <li>Auto-selects first available date on mount</li>
              <li>Auto-selects first available slot when date changes</li>
              <li>CTA disabled when no valid selection or sold out</li>
            </ul>
          </div>

          <div>
            <div className="font-medium text-gray-900 mb-1">Integration Points:</div>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>Events: Use for event registration with multiple showtimes</li>
              <li>Offers: Use for course/service booking with time slots</li>
              <li>Business flows: Embed in wizard steps or standalone pages</li>
            </ul>
          </div>
        </div>
      </div>
    </SectionWrapper>
  );
}
