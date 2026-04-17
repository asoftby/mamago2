"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScheduleEditor } from "@/components/schedule-editor/ScheduleEditor";
import type { ActivityFormData, ActivityType, PricingMode, BookingMode, ActivityCTAType } from "./types";

interface ActivityFormProps {
  data: ActivityFormData;
  onChange: (data: ActivityFormData) => void;
}

export function ActivityForm({ data, onChange }: ActivityFormProps) {
  const handleChange = (updates: Partial<ActivityFormData>) => {
    onChange({ ...data, ...updates });
  };

  return (
    <div className="space-y-6">
      {/* Basic Info */}
      <div className="space-y-4">
        <h3 className="text-base font-semibold text-gray-900">Основная информация</h3>
        
        <div className="space-y-2">
          <Label htmlFor="title">Название</Label>
          <Input
            id="title"
            value={data.title}
            onChange={(e) => handleChange({ title: e.target.value })}
            placeholder="Мастер-класс по керамике"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="description">Короткое описание</Label>
          <Input
            id="description"
            value={data.description}
            onChange={(e) => handleChange({ description: e.target.value })}
            placeholder="Создайте свою уникальную керамическую посуду"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="duration">Длительность</Label>
            <Input
              id="duration"
              value={data.duration}
              onChange={(e) => handleChange({ duration: e.target.value })}
              placeholder="90 минут"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ageContext">Возраст / Контекст</Label>
            <Input
              id="ageContext"
              value={data.ageContext}
              onChange={(e) => handleChange({ ageContext: e.target.value })}
              placeholder="Для детей 5–7 лет"
            />
          </div>
        </div>
      </div>

      {/* Activity Type */}
      <div className="space-y-3">
        <h3 className="text-base font-semibold text-gray-900">Тип активности</h3>
        <div className="grid grid-cols-2 gap-2">
          {[
            { value: "event", label: "Событие" },
            { value: "course", label: "Курс" },
            { value: "lesson", label: "Занятие" },
            { value: "service", label: "Услуга" },
            { value: "offer", label: "Предложение" },
          ].map((type) => (
            <button
              key={type.value}
              type="button"
              onClick={() => handleChange({ activityType: type.value as ActivityType })}
              className={`px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${
                data.activityType === type.value
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-white text-gray-700 border-gray-300 hover:border-primary/50"
              }`}
            >
              {type.label}
            </button>
          ))}
        </div>
      </div>

      {/* Pricing Mode */}
      <div className="space-y-3">
        <h3 className="text-base font-semibold text-gray-900">Ценообразование</h3>
        <div className="grid grid-cols-2 gap-2">
          {[
            { value: "free", label: "Бесплатно" },
            { value: "fixed", label: "Фиксированная цена" },
            { value: "from", label: 'Цена "от"' },
            { value: "on-request", label: "По запросу" },
          ].map((mode) => (
            <button
              key={mode.value}
              type="button"
              onClick={() => handleChange({ pricingMode: mode.value as PricingMode })}
              className={`px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${
                data.pricingMode === mode.value
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-white text-gray-700 border-gray-300 hover:border-primary/50"
              }`}
            >
              {mode.label}
            </button>
          ))}
        </div>

        {data.pricingMode === "fixed" && (
          <div className="space-y-2">
            <Label htmlFor="price">Цена (BYN)</Label>
            <Input
              id="price"
              type="number"
              value={data.price}
              onChange={(e) => handleChange({ price: parseFloat(e.target.value) || 0 })}
            />
          </div>
        )}

        {data.pricingMode === "from" && (
          <div className="space-y-2">
            <Label htmlFor="priceFrom">Цена от (BYN)</Label>
            <Input
              id="priceFrom"
              type="number"
              value={data.priceFrom}
              onChange={(e) => handleChange({ priceFrom: parseFloat(e.target.value) || 0 })}
            />
          </div>
        )}
      </div>

      {/* Booking Mode */}
      <div className="space-y-3">
        <h3 className="text-base font-semibold text-gray-900">Режим записи</h3>
        <div className="grid grid-cols-2 gap-2">
          {[
            { value: "none", label: "Без записи" },
            { value: "request", label: "Заявка" },
            { value: "single", label: "Одна дата" },
            { value: "multi-date", label: "Несколько дат" },
            { value: "slots", label: "Слоты" },
          ].map((mode) => (
            <button
              key={mode.value}
              type="button"
              onClick={() => handleChange({ bookingMode: mode.value as BookingMode })}
              className={`px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${
                data.bookingMode === mode.value
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-white text-gray-700 border-gray-300 hover:border-primary/50"
              }`}
            >
              {mode.label}
            </button>
          ))}
        </div>
      </div>

      {/* Schedule */}
      {data.bookingMode === "single" && (
        <div className="space-y-3">
          <h3 className="text-base font-semibold text-gray-900">Дата и время</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="singleDate">Дата</Label>
              <Input
                id="singleDate"
                type="date"
                value={data.singleDate || ""}
                onChange={(e) => handleChange({ singleDate: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="singleTime">Время</Label>
              <Input
                id="singleTime"
                value={data.singleTime || ""}
                onChange={(e) => handleChange({ singleTime: e.target.value })}
                placeholder="12:00–13:30"
              />
            </div>
          </div>
        </div>
      )}

      {(data.bookingMode === "multi-date" || data.bookingMode === "slots") && (
        <div className="space-y-3">
          <h3 className="text-base font-semibold text-gray-900">Расписание</h3>
          <ScheduleEditor
            value={data.schedule}
            onChange={(schedule) => handleChange({ schedule })}
          />
        </div>
      )}

      {/* CTA Type */}
      <div className="space-y-3">
        <h3 className="text-base font-semibold text-gray-900">Кнопка действия</h3>
        <div className="grid grid-cols-2 gap-2">
          {[
            { value: "book", label: "Записаться" },
            { value: "buy", label: "Купить" },
            { value: "request", label: "Оставить заявку" },
            { value: "details", label: "Подробнее" },
          ].map((cta) => (
            <button
              key={cta.value}
              type="button"
              onClick={() => handleChange({ ctaType: cta.value as ActivityCTAType })}
              className={`px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${
                data.ctaType === cta.value
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-white text-gray-700 border-gray-300 hover:border-primary/50"
              }`}
            >
              {cta.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
