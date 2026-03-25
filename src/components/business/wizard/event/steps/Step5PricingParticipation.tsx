"use client";

import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScheduleEditor } from "@/components/schedule-editor/ScheduleEditor";
import { Ticket, Clock, Info, type LucideIcon } from "lucide-react";
import type { EventFormData } from "../types";
import {
  FIXED_PARTICIPATION_CTA_PREVIEW,
  normalizeParticipationMode,
  type ParticipationModeUi,
} from "../participationCtaLabels";
import { cn } from "@/lib/utils";

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
  /** walk-in первым — совпадает с дефолтом формы и не выглядит как «выбран билет по умолчанию». */
  const participationItems: Array<{
    value: ParticipationModeUi;
    label: string;
    description: string;
    icon: LucideIcon;
  }> = [
    {
      value: "walk-in",
      label: "Узнать подробнее",
      description: "Пользователь открывает страницу события и знакомится с деталями",
      icon: Info,
    },
    {
      value: "external-link",
      label: "Купить билет",
      description: "Билеты продаются на внешнем сайте",
      icon: Ticket,
    },
    {
      value: "time-slots",
      label: "Записаться по времени",
      description: "Пользователь выбирает удобный слот",
      icon: Clock,
    },
  ];

  const selectedParticipation = normalizeParticipationMode(
    data.participationMode ?? "walk-in",
  );

  const setParticipation = (value: ParticipationModeUi) => {
    onChange({ participationMode: value });
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-semibold mb-2">Стоимость и запись</h2>
        <p className="text-[12px] text-muted-foreground">
          Быстро настройте цену и сценарий участия
        </p>
      </div>

      {/* Block 1: Pricing */}
      <div className="space-y-4">
        <h3 className="text-base font-semibold text-gray-900">Стоимость</h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {[
            { value: "free", label: "Бесплатно" },
            { value: "fixed", label: "Фиксированная цена" },
            { value: "from", label: "Цена от" },
          ].map((mode) => (
            <button
              key={mode.value}
              type="button"
              onClick={() => onChange({ pricingMode: mode.value as EventFormData["pricingMode"] })}
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

            {data.pricingMode === "from" && (
              <div className="space-y-2">
                <Label htmlFor="priceDetails">Детали стоимости (опционально)</Label>
                <textarea
                  id="priceDetails"
                  value={data.priceDetails}
                  onChange={(e) => onChange({ priceDetails: e.target.value })}
                  placeholder="Дети — 30 BYN&#10;Взрослые — 50 BYN&#10;Семейный билет — 80 BYN"
                  rows={4}
                  disabled={!isEditable}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed resize-none"
                />
                <p className="text-[12px] text-gray-600">Если есть разные цены — укажите их тут</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Block 2: Participation */}
      <div className="space-y-4">
        <h3 className="text-base font-semibold text-gray-900">Как попасть на событие?</h3>

        <div className="space-y-3">
          {participationItems.map((item) => {
            const Icon = item.icon;
            const isSelected = selectedParticipation === item.value;
            const previewText = FIXED_PARTICIPATION_CTA_PREVIEW[item.value];
            return (
              <div
                key={item.value}
                className={cn(
                  "rounded-xl border transition-colors overflow-hidden",
                  isSelected
                    ? "border-primary bg-primary/5 shadow-sm"
                    : "border-gray-200 bg-white hover:border-gray-300",
                )}
              >
                <button
                  type="button"
                  onClick={() => setParticipation(item.value)}
                  disabled={!isEditable}
                  className="w-full text-left px-4 py-3.5 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <div className="flex items-start gap-3">
                    <Icon
                      className={cn(
                        "w-5 h-5 flex-shrink-0 mt-0.5",
                        isSelected ? "text-primary" : "text-muted-foreground",
                      )}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm text-gray-900">{item.label}</div>
                      <div className="text-[12px] text-gray-600 mt-0.5">{item.description}</div>
                    </div>
                  </div>
                </button>

                {isSelected && (
                  <div className="border-t border-primary/15 bg-muted/50 px-4 py-4 space-y-4">
                    {item.value === "external-link" && (
                      <div className="space-y-2">
                        <Label htmlFor="ticketLink">Ссылка на покупку билета</Label>
                        <Input
                          id="ticketLink"
                          type="url"
                          value={data.ticketLink}
                          onChange={(e) => onChange({ ticketLink: e.target.value })}
                          placeholder="https://..."
                          disabled={!isEditable}
                        />
                      </div>
                    )}

                    {item.value === "time-slots" && (
                      <div className="space-y-3">
                        <ScheduleEditor
                          value={data.timeSlots}
                          onChange={(timeSlots) => onChange({ timeSlots })}
                        />
                      </div>
                    )}

                    <div className="pt-1 space-y-3 rounded-lg border border-border/60 bg-background/80 p-4">
                      <p className="text-sm font-medium text-foreground">
                        Как это увидит пользователь
                      </p>
                      <Button
                        type="button"
                        variant="default"
                        size="lg"
                        tabIndex={-1}
                        aria-hidden
                        className="pointer-events-none h-12 min-h-[48px] w-full max-w-xs cursor-default select-none rounded-2xl px-6 text-[15px] opacity-100"
                      >
                        {previewText}
                      </Button>
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
