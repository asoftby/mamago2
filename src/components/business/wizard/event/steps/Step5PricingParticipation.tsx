"use client";

import { useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { WizardRichTextField } from "@/components/business/wizard/shared/WizardRichTextField";
import {
  PublicationAccessEditor,
  type PublicationAccess,
  type PublicationAccessTimeSlot,
} from "@/features/publication-access";
import type { EventFormData } from "../types";
import { PriceListEditor } from "@/components/shared/PriceListEditor";
import { BYN_SYMBOL, normalizeRichTextCurrency } from "@/lib/formatters/format-price";
import { renderCurrencyText } from "@/components/icons/BelarusianRubleIcon";

interface Step5PricingParticipationProps {
  data: EventFormData;
  onChange: (updates: Partial<EventFormData>) => void;
  isEditable: boolean;
  eventId?: string;
}

function flattenEventTimeSlots(
  value: EventFormData["timeSlots"],
): PublicationAccessTimeSlot[] {
  return value.dates.flatMap((date) =>
    date.slots.map((slot) => ({
      id: slot.id,
      date: date.isoDate,
      startTime: slot.startTime,
      endTime: slot.endTime,
      capacity: slot.capacity,
    })),
  );
}

function buildEventTimeSlots(
  timeSlots: PublicationAccessTimeSlot[] | undefined,
): EventFormData["timeSlots"] {
  const byDate = new Map<
    string,
    {
      id: string;
      isoDate: string;
      label: string;
      slots: EventFormData["timeSlots"]["dates"][number]["slots"];
    }
  >();

  for (const slot of timeSlots ?? []) {
    if (!slot.date || !slot.startTime) continue;
    const existing = byDate.get(slot.date);
    const slotRecord = {
      id: slot.id,
      startTime: slot.startTime,
      endTime: slot.endTime ?? slot.startTime,
      capacity: slot.capacity ?? 1,
    };

    if (existing) {
      existing.slots.push(slotRecord);
      continue;
    }

    byDate.set(slot.date, {
      id: `date-${slot.date}`,
      isoDate: slot.date,
      label: slot.date,
      slots: [slotRecord],
    });
  }

  return {
    dates: Array.from(byDate.values()).sort((a, b) =>
      a.isoDate.localeCompare(b.isoDate),
    ),
  };
}

function getPublicationAccessFromEvent(data: EventFormData): PublicationAccess {
  if (data.publicationAccess) return data.publicationAccess;

  if (data.participationMode === "external-link") {
    return {
      method: "ticket",
      ticketUrl: data.ticketLink,
    };
  }

  if (data.participationMode === "time-slots") {
    return {
      method: "timeslots",
      timeSlots: flattenEventTimeSlots(data.timeSlots),
    };
  }

  if (data.participationMode === "prebook") {
    return {
      method: "prebooking",
      phone: data.prebookPhone,
      externalUrl: data.prebookUrl,
    };
  }

  return {
    method: "details",
  };
}

function buildEventAccessPatch(access: PublicationAccess): Partial<EventFormData> {
  if (access.method === "ticket") {
    return {
      publicationAccess: access,
      participationMode: "external-link",
      ticketLink: access.ticketUrl ?? "",
    };
  }

  if (access.method === "timeslots") {
    return {
      publicationAccess: access,
      participationMode: "time-slots",
      timeSlots: buildEventTimeSlots(access.timeSlots),
    };
  }

  if (access.method === "prebooking") {
    return {
      publicationAccess: access,
      participationMode: "prebook",
      prebookMethod: access.externalUrl?.trim() && !access.phone?.trim() ? "link" : "phone",
      prebookPhone: access.phone ?? "",
      prebookUrl: access.externalUrl ?? "",
    };
  }

  return {
    publicationAccess: access,
    participationMode: "walk-in",
  };
}

export function Step5PricingParticipation({
  data,
  onChange,
  isEditable,
}: Step5PricingParticipationProps) {
  const publicationAccess = useMemo(
    () => getPublicationAccessFromEvent(data),
    [data],
  );
  const currencyMark = renderCurrencyText(BYN_SYMBOL, { iconSize: "sm" });
  // Placeholder редактора деталей — рич-текст-канон (текст Br), без PUA-тофу.
  const pricingDetailsExample = normalizeRichTextCurrency(
    "Дети — 30 Br\nВзрослые — 50 Br\nСемейный билет — 80 Br",
  );

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-semibold mb-2">Стоимость и запись</h2>
        <p className="text-[12px] text-muted-foreground">
          Быстро настройте цену и сценарий участия
        </p>
      </div>

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
              onClick={() =>
                onChange({ pricingMode: mode.value as EventFormData["pricingMode"] })
              }
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
                {data.pricingMode === "fixed" ? "Цена (" : "Цена от ("}
                {currencyMark}
                {")"}
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
                <WizardRichTextField
                  label="Детали стоимости"
                  helperText="Если есть разные цены или условия, укажите их здесь."
                  value={data.priceDetails}
                  onChange={(value) => onChange({ priceDetails: value })}
                  placeholder={pricingDetailsExample}
                  disabled={!isEditable}
                  minHeight={140}
                />
              </div>
            )}
          </div>
        )}
      </div>

      <div className="space-y-3">
        <div>
          <h3 className="text-base font-semibold text-gray-900">Детализация цен</h3>
          <p className="text-sm text-muted-foreground mt-0.5">
            Добавьте отдельные строки с ценами для разных категорий участников.
          </p>
        </div>
        <PriceListEditor
          value={data.priceItems}
          onChange={(priceItems) => onChange({ priceItems })}
          disabled={!isEditable}
        />
      </div>

      <PublicationAccessEditor
        entityType="event"
        value={publicationAccess}
        onChange={(value) => onChange(buildEventAccessPatch(value))}
        allowedMethods={["details", "ticket", "timeslots", "prebooking"]}
        disabled={!isEditable}
      />
    </div>
  );
}
