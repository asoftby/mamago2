"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { ScheduleEditor } from "@/components/schedule-editor/ScheduleEditor";
import { Ticket, Clock, Info, PhoneCall, type LucideIcon } from "lucide-react";
import type { EventFormData } from "../types";
import {
  FIXED_PARTICIPATION_CTA_PREVIEW,
  normalizeParticipationMode,
  type ParticipationModeUi,
} from "../participationCtaLabels";
import { cn } from "@/lib/utils";
import { normalizePhoneToE164 } from "@/lib/phone/e164";

function normalizeForDisplay(value: string): string {
  const e164 = normalizePhoneToE164(value);
  const digits = e164.replace(/\D/g, "");
  if (!digits.startsWith("375") || digits.length < 12) return e164;
  const local = digits.slice(3);
  const aa = local.slice(0, 2);
  const bbb = local.slice(2, 5);
  const cc = local.slice(5, 7);
  const dd = local.slice(7, 9);
  return `+375 ${aa} ${bbb}-${cc}-${dd}`;
}

interface Step5PricingParticipationProps {
  data: EventFormData;
  onChange: (updates: Partial<EventFormData>) => void;
  isEditable: boolean;
  eventId?: string;
}

export function Step5PricingParticipation({
  data,
  onChange,
  isEditable,
  eventId,
}: Step5PricingParticipationProps) {
  const [importPhones, setImportPhones] = useState<string[]>([]);
  const [highlightPhoneField, setHighlightPhoneField] = useState(false);
  const phoneInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!eventId) {
      setImportPhones([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch(`/api/business/events/${eventId}/contact-source`, {
          credentials: "include",
        });
        if (!response.ok) {
          if (!cancelled) setImportPhones([]);
          return;
        }
        const payload = (await response.json()) as { phone?: string; phones?: string[] };
        const candidates = [
          ...(Array.isArray(payload.phones) ? payload.phones : []),
          ...(typeof payload.phone === "string" ? [payload.phone] : []),
        ]
          .map((value) => value.trim())
          .filter((value) => value.length > 0);
        const normalized = [...new Set(candidates.map((phone) => normalizeForDisplay(phone)).filter(Boolean))];
        if (!cancelled) setImportPhones(normalized);
      } catch {
        if (!cancelled) setImportPhones([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [eventId]);

  const visibleImportPhones = useMemo(() => importPhones.slice(0, 3), [importPhones]);
  const hiddenImportPhonesCount = Math.max(0, importPhones.length - visibleImportPhones.length);

  const selectedParticipation = normalizeParticipationMode(
    data.participationMode ?? "walk-in",
  );

  const canShowPhoneImportBlock =
    selectedParticipation === "prebook" &&
    data.prebookMethod === "phone" &&
    importPhones.length > 0;

  const applyPhoneFromSource = (value: string) => {
    const normalized = normalizePhoneToE164(value);
    onChange({ prebookPhone: normalized });
    requestAnimationFrame(() => {
      phoneInputRef.current?.focus();
      setHighlightPhoneField(true);
    });
  };

  useEffect(() => {
    if (!highlightPhoneField) return;
    const timeout = setTimeout(() => setHighlightPhoneField(false), 1400);
    return () => clearTimeout(timeout);
  }, [highlightPhoneField]);

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
    {
      value: "prebook",
      label: "Предварительная запись",
      description: "Пользователь записывается заранее по телефону или по ссылке",
      icon: PhoneCall,
    },
  ];

  const setParticipation = (value: ParticipationModeUi) => {
    onChange({
      participationMode: value,
      ...(value !== "prebook"
        ? {
            prebookMethod: null,
            prebookPhone: "",
            prebookUrl: "",
          }
        : {}),
    });
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
                <Textarea
                  id="priceDetails"
                  value={data.priceDetails}
                  onChange={(e) => onChange({ priceDetails: e.target.value })}
                  placeholder="Дети — 30 BYN&#10;Взрослые — 50 BYN&#10;Семейный билет — 80 BYN"
                  rows={4}
                  disabled={!isEditable}
                  className="resize-none"
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

                    {item.value === "prebook" && (
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label>Способ записи</Label>
                          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                            {[
                              {
                                value: "phone" as const,
                                label: "По телефону",
                                description: "Кнопка откроет набор номера",
                              },
                              {
                                value: "link" as const,
                                label: "По ссылке",
                                description: "Кнопка откроет внешнюю форму записи",
                              },
                            ].map((method) => {
                              const active = data.prebookMethod === method.value;
                              return (
                                <button
                                  key={method.value}
                                  type="button"
                                  onClick={() =>
                                    onChange({
                                      prebookMethod: method.value,
                                      ...(method.value === "phone"
                                        ? { prebookUrl: "" }
                                        : { prebookPhone: "" }),
                                    })
                                  }
                                  disabled={!isEditable}
                                  className={cn(
                                    "rounded-lg border px-4 py-3 text-left transition-colors",
                                    active
                                      ? "border-primary bg-primary/5"
                                      : "border-border bg-background hover:border-primary/40",
                                  )}
                                >
                                  <div className="text-sm font-medium text-foreground">{method.label}</div>
                                  <div className="mt-1 text-[12px] text-muted-foreground">{method.description}</div>
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        {data.prebookMethod === "phone" && (
                          <div className="space-y-3">
                            <Label htmlFor="prebookPhone">Телефон для записи</Label>
                            <div
                              className={cn(
                                "rounded-lg border border-transparent p-0.5 transition-colors",
                                highlightPhoneField && "border-emerald-300 bg-emerald-50/60",
                              )}
                            >
                              <Input
                                id="prebookPhone"
                                ref={phoneInputRef}
                                type="tel"
                                value={data.prebookPhone}
                                onChange={(e) => onChange({ prebookPhone: e.target.value })}
                                placeholder="+375 29 123 45 67"
                                disabled={!isEditable}
                              />
                            </div>
                            {canShowPhoneImportBlock ? (
                              <div className="rounded-xl border border-sky-200 bg-sky-50/60 p-3">
                                <div className="mb-2">
                                  <p className="text-sm font-semibold text-sky-950">Контакты из источника</p>
                                  <p className="text-[12px] text-sky-900/70">Найдено в импортированных данных</p>
                                </div>
                                <div className="space-y-2">
                                  {visibleImportPhones.map((phone) => (
                                    <div
                                      key={phone}
                                      className="flex items-center justify-between gap-3 rounded-lg border border-sky-100 bg-white px-3 py-2"
                                    >
                                      <span className="text-sm text-slate-800">{phone}</span>
                                      <Button
                                        type="button"
                                        size="sm"
                                        variant="outline"
                                        disabled={!isEditable}
                                        onClick={() => applyPhoneFromSource(phone)}
                                      >
                                        Применить
                                      </Button>
                                    </div>
                                  ))}
                                </div>
                                {hiddenImportPhonesCount > 0 ? (
                                  <p className="mt-2 text-[12px] text-sky-900/70">И ещё {hiddenImportPhonesCount}</p>
                                ) : null}
                                {importPhones.length === 1 ? (
                                  <div className="mt-2">
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant="secondary"
                                      disabled={!isEditable}
                                      onClick={() => applyPhoneFromSource(importPhones[0]!)}
                                    >
                                      Вставить из источника
                                    </Button>
                                  </div>
                                ) : null}
                              </div>
                            ) : null}
                          </div>
                        )}

                        {data.prebookMethod === "link" && (
                          <div className="space-y-2">
                            <Label htmlFor="prebookUrl">Ссылка на запись</Label>
                            <Input
                              id="prebookUrl"
                              type="url"
                              value={data.prebookUrl}
                              onChange={(e) => onChange({ prebookUrl: e.target.value })}
                              placeholder="https://..."
                              disabled={!isEditable}
                            />
                          </div>
                        )}
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
