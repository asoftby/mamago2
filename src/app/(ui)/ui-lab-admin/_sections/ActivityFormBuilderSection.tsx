"use client";

import { useState } from "react";
import { SectionWrapper } from "../_components/SectionWrapper";
import { ActivityForm } from "@/components/activity-builder/ActivityForm";
import { ActivityPreview } from "@/components/activity-builder/ActivityPreview";
import { presets } from "@/components/activity-builder/presets";
import type { ActivityFormData } from "@/components/activity-builder/types";

export function ActivityFormBuilderSection() {
  const [activityData, setActivityData] = useState<ActivityFormData>(presets.singleEvent);
  const [activePreset, setActivePreset] = useState<string>("singleEvent");

  const handlePresetChange = (presetKey: string) => {
    setActivePreset(presetKey);
    if (presetKey === "singleEvent") setActivityData(presets.singleEvent);
    if (presetKey === "courseWithSlots") setActivityData(presets.courseWithSlots);
    if (presetKey === "serviceByRequest") setActivityData(presets.serviceByRequest);
  };

  return (
    <SectionWrapper
      id="activity-form-builder"
      title="Activity Form Builder"
      description="Единая архитектура формы активности для событий, курсов, услуг и предложений"
    >
      {/* Introduction */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <h3 className="text-base font-semibold text-blue-900 mb-3">Ключевая идея</h3>
        <div className="space-y-2 text-sm text-blue-900">
          <p>
            Вместо отдельных форм для event/course/service/offer используется единая форма Activity,
            где поведение определяется через настройки.
          </p>
          <div className="mt-4 space-y-1.5">
            <p className="font-medium">Как это работает:</p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>Бизнес заполняет данные активности (название, описание, цена)</li>
              <li>Выбирает тип активности и режим записи</li>
              <li>Настраивает расписание через Schedule Editor</li>
              <li>Блок "Записаться / Купить" строится автоматически</li>
              <li>Не нужно вручную редактировать booking widget</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Quick Presets */}
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-sm font-medium text-gray-700">Быстрые сценарии:</span>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => handlePresetChange("singleEvent")}
            className={`px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${
              activePreset === "singleEvent"
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-white text-gray-700 border-gray-300 hover:border-primary/50"
            }`}
          >
            Разовое событие
          </button>
          <button
            type="button"
            onClick={() => handlePresetChange("courseWithSlots")}
            className={`px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${
              activePreset === "courseWithSlots"
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-white text-gray-700 border-gray-300 hover:border-primary/50"
            }`}
          >
            Курс со слотами
          </button>
          <button
            type="button"
            onClick={() => handlePresetChange("serviceByRequest")}
            className={`px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${
              activePreset === "serviceByRequest"
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-white text-gray-700 border-gray-300 hover:border-primary/50"
            }`}
          >
            Услуга по заявке
          </button>
        </div>
      </div>

      {/* Main Layout */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
        <div className="grid grid-cols-1 lg:grid-cols-[60%_40%] gap-6">
          {/* Left: Form */}
          <div>
            <div className="mb-4">
              <h3 className="text-base font-semibold text-gray-900">Форма активности</h3>
              <p className="text-sm text-gray-600 mt-1">
                Заполните данные, выберите режимы и настройте расписание
              </p>
            </div>
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <ActivityForm data={activityData} onChange={setActivityData} />
            </div>
          </div>

          {/* Right: Preview */}
          <div>
            <div className="mb-4">
              <h3 className="text-base font-semibold text-gray-900">Live Preview</h3>
              <p className="text-sm text-gray-600 mt-1">
                Так это увидит пользователь
              </p>
            </div>
            <div className="sticky top-6">
              <ActivityPreview data={activityData} />
            </div>
          </div>
        </div>
      </div>

      {/* Architecture Explanation */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h3 className="text-base font-semibold text-gray-900 mb-4">Архитектура Activity</h3>
        <div className="space-y-4 text-sm text-gray-700">
          <div>
            <div className="font-medium text-gray-900 mb-2">Класс активности (событие / курс / услуга):</div>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>Событие - разовые мероприятия, спектакли, выставки</li>
              <li>Курс - регулярные занятия с расписанием</li>
              <li>Занятие - пробные или разовые занятия</li>
              <li>Услуга - консультации, индивидуальные услуги</li>
              <li>Предложение - специальные предложения, акции</li>
            </ul>
          </div>

          <div>
            <div className="font-medium text-gray-900 mb-2">Booking Mode (Режим записи):</div>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>Без записи - информационная активность</li>
              <li>Заявка - пользователь оставляет заявку, бизнес связывается</li>
              <li>Одна дата - фиксированная дата и время</li>
              <li>Несколько дат - выбор из доступных дат</li>
              <li>Слоты - выбор даты и временного слота</li>
            </ul>
          </div>

          <div>
            <div className="font-medium text-gray-900 mb-2">Pricing Mode (Ценообразование):</div>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>Бесплатно - без оплаты</li>
              <li>Фиксированная цена - точная стоимость</li>
              <li>Цена "от" - минимальная цена, может варьироваться</li>
              <li>По запросу - цена обсуждается индивидуально</li>
            </ul>
          </div>

          <div>
            <div className="font-medium text-gray-900 mb-2">CTA Type (Кнопка действия):</div>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>Записаться - для занятий и курсов</li>
              <li>Купить - для событий с билетами</li>
              <li>Оставить заявку - для услуг по запросу</li>
              <li>Подробнее - для информационных активностей</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Benefits */}
      <div className="bg-green-50 border border-green-200 rounded-lg p-6">
        <h3 className="text-base font-semibold text-green-900 mb-4">
          Почему единая Activity лучше отдельных форм?
        </h3>
        <div className="space-y-3 text-sm text-green-900">
          <div className="flex gap-3">
            <div className="flex-shrink-0 w-6 h-6 rounded-full bg-green-100 text-green-700 flex items-center justify-center text-xs font-bold">
              1
            </div>
            <div>
              <div className="font-medium">Единая кодовая база</div>
              <div className="text-xs text-green-800 mt-0.5">
                Один компонент вместо 5+ отдельных форм для event/course/service/offer
              </div>
            </div>
          </div>

          <div className="flex gap-3">
            <div className="flex-shrink-0 w-6 h-6 rounded-full bg-green-100 text-green-700 flex items-center justify-center text-xs font-bold">
              2
            </div>
            <div>
              <div className="font-medium">Гибкость</div>
              <div className="text-xs text-green-800 mt-0.5">
                Легко добавить новый тип активности или режим записи
              </div>
            </div>
          </div>

          <div className="flex gap-3">
            <div className="flex-shrink-0 w-6 h-6 rounded-full bg-green-100 text-green-700 flex items-center justify-center text-xs font-bold">
              3
            </div>
            <div>
              <div className="font-medium">Консистентность</div>
              <div className="text-xs text-green-800 mt-0.5">
                Одинаковый UX для всех типов активностей
              </div>
            </div>
          </div>

          <div className="flex gap-3">
            <div className="flex-shrink-0 w-6 h-6 rounded-full bg-green-100 text-green-700 flex items-center justify-center text-xs font-bold">
              4
            </div>
            <div>
              <div className="font-medium">Автоматическая генерация UI</div>
              <div className="text-xs text-green-800 mt-0.5">
                Booking widget строится автоматически из данных формы
              </div>
            </div>
          </div>

          <div className="flex gap-3">
            <div className="flex-shrink-0 w-6 h-6 rounded-full bg-green-100 text-green-700 flex items-center justify-center text-xs font-bold">
              5
            </div>
            <div>
              <div className="font-medium">Легкая поддержка</div>
              <div className="text-xs text-green-800 mt-0.5">
                Изменения в одном месте применяются ко всем типам
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Technical Notes */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h3 className="text-base font-semibold text-gray-900 mb-4">Technical Implementation</h3>
        <div className="space-y-4 text-sm text-gray-700">
          <div>
            <div className="font-medium text-gray-900 mb-1">Component Structure:</div>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li><code className="text-xs bg-white px-1 py-0.5 rounded border">ActivityForm</code> - Form with all fields and modes</li>
              <li><code className="text-xs bg-white px-1 py-0.5 rounded border">ActivityPreview</code> - Live preview of user-facing widget</li>
              <li><code className="text-xs bg-white px-1 py-0.5 rounded border">ScheduleEditor</code> - Integrated for slots mode</li>
              <li><code className="text-xs bg-white px-1 py-0.5 rounded border">BookingCard</code> - Reused for preview rendering</li>
            </ul>
          </div>

          <div>
            <div className="font-medium text-gray-900 mb-1">Data Flow:</div>
            <div className="bg-gray-50 border border-gray-200 rounded p-3 font-mono text-xs">
              <div>Business fills ActivityFormData</div>
              <div className="ml-4 text-gray-600">↓</div>
              <div>Form updates state</div>
              <div className="ml-4 text-gray-600">↓</div>
              <div>Preview auto-updates</div>
              <div className="ml-4 text-gray-600">↓</div>
              <div>Booking widget renders based on modes</div>
            </div>
          </div>

          <div>
            <div className="font-medium text-gray-900 mb-1">Integration Points:</div>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>Business dashboard - create new activity</li>
              <li>Activity management - edit existing activities</li>
              <li>Public pages - display booking widgets</li>
              <li>API layer - save ActivityFormData to database</li>
            </ul>
          </div>
        </div>
      </div>
    </SectionWrapper>
  );
}
