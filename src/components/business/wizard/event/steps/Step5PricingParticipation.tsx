"use client";

import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { ScheduleEditor } from "@/components/schedule-editor/ScheduleEditor";
import { Ticket, Clock, UserPlus, Send, Info } from "lucide-react";
import type { EventFormData } from "../types";

interface Step5PricingParticipationProps {
  data: EventFormData;
  onChange: (updates: Partial<EventFormData>) => void;
  isEditable: boolean;
}

export function Step5PricingParticipation({
  data,
  onChange,
  isEditable,
}: Step5PricingParticipationProps) {
  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-semibold mb-2">Стоимость и запись</h2>
        <p className="text-sm text-muted-foreground">
          Настройте цену и способ взаимодействия с пользователями
        </p>
      </div>

      {/* Pricing Mode */}
      <div className="space-y-4">
        <h3 className="text-base font-semibold text-gray-900">Стоимость</h3>
        <div className="grid grid-cols-2 gap-3">
          {[
            { value: "free", label: "Бесплатно" },
            { value: "fixed", label: "Фиксированная цена" },
            { value: "from", label: 'Цена "от"' },
            { value: "on-request", label: "По запросу" },
          ].map((mode) => (
            <button
              key={mode.value}
              type="button"
              onClick={() => onChange({ pricingMode: mode.value as any })}
              disabled={!isEditable}
              className={`px-4 py-3 rounded-lg border text-sm font-medium transition-colors ${
                data.pricingMode === mode.value
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-white text-gray-700 border-gray-300 hover:border-primary/50"
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {mode.label}
            </button>
          ))}
        </div>

        {/* Price Input */}
        {(data.pricingMode === "fixed" || data.pricingMode === "from") && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="price">
                {data.pricingMode === "fixed" ? "Цена (BYN)" : "Цена от (BYN)"}
              </Label>
              <Input
                id="price"
                type="text"
                value={data.price}
                onChange={(e) => onChange({ price: e.target.value })}
                placeholder={data.pricingMode === "fixed" ? "50" : "30"}
                disabled={!isEditable}
              />
            </div>

            {/* Price Details - only for "from" mode */}
            {data.pricingMode === "from" && (
              <div className="space-y-2">
                <Label htmlFor="priceDetails">
                  Детали стоимости (опционально)
                </Label>
                <textarea
                  id="priceDetails"
                  value={data.priceDetails}
                  onChange={(e) => onChange({ priceDetails: e.target.value })}
                  placeholder="Дети — 30 BYN&#10;Взрослые — 50 BYN&#10;Семейный билет — 80 BYN"
                  rows={4}
                  disabled={!isEditable}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed resize-none"
                />
                <p className="text-xs text-gray-600">
                  Укажите варианты цен, если стоимость зависит от категории
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Participation Mode */}
      <div className="space-y-4">
        <div>
          <h3 className="text-base font-semibold text-gray-900 mb-1">
            Как пользователь взаимодействует с событием?
          </h3>
          <p className="text-sm text-gray-600">
            Выберите подходящий формат участия
          </p>
        </div>

        <div className="space-y-2">
          {[
            {
              value: "external-link",
              label: "Покупка билета по ссылке",
              description: "Билеты продаются на внешнем сайте",
              icon: Ticket,
            },
            {
              value: "time-slots",
              label: "Запись по времени (слоты)",
              description: "Для мастер-классов с выбором конкретного времени",
              icon: Clock,
            },
            {
              value: "simple-booking",
              label: "Простая запись",
              description: "Участник оставляет заявку на событие",
              icon: UserPlus,
            },
            {
              value: "request",
              label: "Оставить заявку",
              description: "Пользователь отправляет заявку, вы связываетесь",
              icon: Send,
            },
            {
              value: "info-only",
              label: "Только информация",
              description: "Событие без записи, просто для ознакомления",
              icon: Info,
            },
          ].map((mode) => {
            const Icon = mode.icon;
            const isSelected = data.participationMode === mode.value;
            
            return (
              <div
                key={mode.value}
                className={`rounded-lg border transition-colors ${
                  isSelected
                    ? "bg-primary/5 border-primary"
                    : "bg-white border-gray-300"
                }`}
              >
                <button
                  type="button"
                  onClick={() => onChange({ participationMode: mode.value as any })}
                  disabled={!isEditable}
                  className={`w-full text-left px-4 py-3 transition-colors hover:border-primary/50 disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  <div className="flex items-start gap-3">
                    <Icon 
                      className={`w-5 h-5 flex-shrink-0 mt-0.5 ${
                        isSelected ? "text-primary" : "text-muted-foreground"
                      }`}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm text-gray-900">{mode.label}</div>
                      <div className="text-xs text-gray-600 mt-0.5">{mode.description}</div>
                    </div>
                  </div>
                </button>

                {/* Nested Settings - External Link */}
                {isSelected && mode.value === "external-link" && (
                  <div className="px-4 pb-4 space-y-4 transition-all duration-200 ease-out">
                    <div className="border-t border-primary/20 pt-4">
                      <div className="text-sm font-medium text-primary mb-3">
                        Внешняя ссылка на покупку
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="ticketLink">Ссылка на покупку билетов</Label>
                        <Input
                          id="ticketLink"
                          type="url"
                          value={data.ticketLink}
                          onChange={(e) => onChange({ ticketLink: e.target.value })}
                          placeholder="https://..."
                          disabled={!isEditable}
                        />
                        <p className="text-xs text-gray-600">
                          Укажите ссылку на сайт, где продаются билеты
                        </p>
                      </div>

                      <div className="bg-white border border-primary/20 rounded p-3 text-xs text-gray-700 mt-3">
                        <strong>Как это работает:</strong> Пользователь увидит кнопку "Купить билет" и
                        перейдет на внешний сайт для покупки.
                      </div>
                    </div>
                  </div>
                )}

                {/* Nested Settings - Time Slots */}
                {isSelected && mode.value === "time-slots" && (
                  <div className="px-4 pb-4 space-y-4 transition-all duration-200 ease-out">
                    <div className="border-t border-primary/20 pt-4">
                      <div>
                        <div className="text-sm font-medium text-primary mb-1">
                          Расписание со слотами
                        </div>
                        <p className="text-xs text-primary/80">
                          Подходит для мастер-классов, пробных занятий и небольших групп
                        </p>
                      </div>

                      <ScheduleEditor
                        value={data.timeSlots}
                        onChange={(timeSlots) => onChange({ timeSlots })}
                      />

                      <div className="bg-white border border-primary/20 rounded p-3 text-xs text-gray-700 mt-3">
                        <strong>Как это работает:</strong> Пользователь выберет удобную дату и время из
                        доступных слотов. Система автоматически отслеживает количество мест.
                      </div>
                    </div>
                  </div>
                )}

                {/* Nested Settings - Simple Booking */}
                {isSelected && mode.value === "simple-booking" && (
                  <div className="px-4 pb-4 space-y-4 transition-all duration-200 ease-out">
                    <div className="border-t border-primary/20 pt-4">
                      <div className="text-sm font-medium text-primary mb-3">
                        Настройки простой записи
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="simpleBookingDate">Дата события</Label>
                          <Input
                            id="simpleBookingDate"
                            type="date"
                            value={data.simpleBookingDate || ""}
                            onChange={(e) => onChange({ simpleBookingDate: e.target.value })}
                            disabled={!isEditable}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="simpleBookingTime">Время</Label>
                          <Input
                            id="simpleBookingTime"
                            value={data.simpleBookingTime || ""}
                            onChange={(e) => onChange({ simpleBookingTime: e.target.value })}
                            placeholder="12:00–13:30"
                            disabled={!isEditable}
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="simpleBookingCapacity">Лимит мест (опционально)</Label>
                        <Input
                          id="simpleBookingCapacity"
                          type="number"
                          min="1"
                          value={data.simpleBookingCapacity || ""}
                          onChange={(e) =>
                            onChange({
                              simpleBookingCapacity: e.target.value ? parseInt(e.target.value) : null,
                            })
                          }
                          placeholder="Например: 20"
                          disabled={!isEditable}
                        />
                        <p className="text-xs text-gray-600">
                          Оставьте пустым, если лимита нет
                        </p>
                      </div>

                      <div className="bg-white border border-primary/20 rounded p-3 text-xs text-gray-700 mt-3">
                        <strong>Как это работает:</strong> Пользователь увидит кнопку "Записаться" и сможет
                        оставить заявку на участие. Вы получите уведомление о новой заявке.
                      </div>
                    </div>
                  </div>
                )}

                {/* Nested Settings - Request */}
                {isSelected && mode.value === "request" && (
                  <div className="px-4 pb-4 transition-all duration-200 ease-out">
                    <div className="border-t border-primary/20 pt-4">
                      <div className="text-sm font-medium text-primary mb-2">
                        Режим заявки
                      </div>
                      <div className="bg-white border border-primary/20 rounded p-3 text-xs text-gray-700">
                        <strong>Как это работает:</strong> Пользователь увидит кнопку "Оставить заявку" и
                        сможет отправить запрос. Вы свяжетесь с ним для уточнения деталей.
                      </div>
                    </div>
                  </div>
                )}

                {/* Nested Settings - Info Only */}
                {isSelected && mode.value === "info-only" && (
                  <div className="px-4 pb-4 transition-all duration-200 ease-out">
                    <div className="border-t border-primary/20 pt-4">
                      <div className="text-sm font-medium text-primary mb-2">
                        Только информация
                      </div>
                      <div className="bg-white border border-primary/20 rounded p-3 text-xs text-gray-700">
                        <strong>Как это работает:</strong> Событие будет отображаться без возможности записи.
                        Пользователи смогут только просматривать информацию.
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

    </div>
  );
}
