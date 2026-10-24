"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ChipsRow, type ChipItem } from "@/components/ui/chips-row";
import { StableCardSelector } from "@/components/ui/stable-card-selector";
import {
  validateExternalUrl,
  type OfferBookingMethod,
  type OfferExternalKind,
  type OfferScheduleForm,
} from "@/lib/offers/offerSchedule";
import type { OfferFormData } from "../types";

interface StepBookingMethodProps {
  data: OfferFormData;
  onChange: (updates: Partial<OfferFormData>) => void;
  isEditable: boolean;
  /** Опубликованный оффер, который правит не сотрудник: ссылку внешней записи менять нельзя. */
  externalUrlLocked?: boolean;
}

const LEGACY_LABELS: Record<NonNullable<OfferScheduleForm["legacyBookingMode"]>, string> = {
  USE_PUBLICATION_DATES: "По расписанию: выбор даты",
  USE_PUBLICATION_SLOTS: "По расписанию: выбор времени",
};

/** Блок «Как к вам записываются»: без записи · по заявке · своя ссылка. */
export function StepBookingMethod({ data, onChange, isEditable, externalUrlLocked = false }: StepBookingMethodProps) {
  const schedule = data.schedule;
  const update = (patch: Partial<OfferScheduleForm>) => onChange({ schedule: { ...schedule, ...patch } });
  // Место, праздник и занятия: два блока расписания перед способом записи; у лагеря — смены на своём блоке выше.
  const number = data.productType === "CAMP" ? 1 : 3;
  const urlError = schedule.bookingMethod === "EXTERNAL" ? validateExternalUrl(schedule.externalUrl) : null;
  const isCamp = data.productType === "CAMP" || data.offerWizardType === "CAMP";

  const kindChips: ChipItem[] = (
    [
      { value: "WEBSITE", label: "Сайт" },
      { value: "TICKETS", label: "Билеты" },
    ] as Array<{ value: OfferExternalKind; label: string }>
  ).map((kind) => ({
    id: kind.value,
    label: kind.label,
    active: schedule.externalKind === kind.value,
    disabled: !isEditable || externalUrlLocked,
    onClick: () => update({ externalKind: kind.value }),
  }));

  return (
    <section className="space-y-4" aria-labelledby="schedule-booking-title">
      <div>
        <h3 id="schedule-booking-title" className="text-base font-semibold">
          {number}. Как к вам записываются
        </h3>
        <p className="text-sm text-muted-foreground">
          {isCamp
            ? "Для лагерей доступна только заявка через mamaGo."
            : "Брони, заявки и закрытие отдельных часов — в Календаре кабинета."}
        </p>
      </div>

      {!isCamp && schedule.legacyBookingMode && !schedule.bookingMethod && (
        <p className="rounded-xl border border-border/70 bg-muted/40 px-3 py-2.5 text-sm">
          Сейчас: {LEGACY_LABELS[schedule.legacyBookingMode]}. Эти настройки и слоты сохранены. Выберите способ ниже,
          только если хотите их заменить.
        </p>
      )}

      <StableCardSelector
        value={isCamp && schedule.bookingMethod !== "REQUEST_ONLY" ? null : schedule.bookingMethod}
        onValueChange={(bookingMethod: OfferBookingMethod) => update({ bookingMethod })}
        options={isCamp ? [{
          value: "REQUEST_ONLY" as const,
          label: "Отправить заявку",
          description: "Родитель отправляет заявку на смену, а вы получаете её в кабинете.",
        }] : [
          {
            value: "NONE" as const,
            label: "Без записи",
            description: "Кнопки записи нет, родители видят режим работы и закрытые дни",
          },
          {
            value: "REQUEST_ONLY" as const,
            label: "По заявке",
            description: "Родитель оставляет заявку и желаемую дату, вы отвечаете в кабинете",
          },
          {
            value: "EXTERNAL" as const,
            label: "Своя ссылка",
            description: "Запись на вашем сайте или покупка билетов",
          },
        ]}
        isEditable={isEditable}
        className="grid gap-3"
      />

      {!isCamp && schedule.bookingMethod === "EXTERNAL" && (
        <div className="space-y-3">
          <ChipsRow items={kindChips} layout="wrap" aria-label="Тип ссылки" />
          <div className="space-y-2">
            <Label htmlFor="schedule-external-url">
              Ссылка <span className="text-red-500">*</span>
            </Label>
            <Input
              id="schedule-external-url"
              type="url"
              inputMode="url"
              placeholder="https://"
              value={schedule.externalUrl}
              onChange={(event) => update({ externalUrl: event.target.value })}
              disabled={!isEditable || externalUrlLocked}
              aria-invalid={Boolean(urlError && schedule.externalUrl)}
            />
            {externalUrlLocked ? (
              <p className="text-sm text-muted-foreground">
                Ссылку опубликованного предложения меняет модерация. Напишите в поддержку.
              </p>
            ) : (
              urlError &&
              schedule.externalUrl.trim() !== "" && <p className="text-sm text-red-600">{urlError}</p>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
