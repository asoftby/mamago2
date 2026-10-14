"use client";

import { useState } from "react";
import { ChipsRow, type ChipItem } from "@/components/ui/chips-row";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  CANCELLATION_CHIPS,
  CUSTOM_TERMS_PREFIX,
  PREPAYMENT_CHIPS,
  SERVICE_AREA_MAX_LENGTH,
  formatCustomOfferTerm,
  matchOfferTerm,
  offerShowsPaymentTerms,
  type OfferTermChip,
} from "@/lib/offers/offerTerms";
import type { OfferFormData } from "../types";

interface StepPaymentTermsProps {
  data: OfferFormData;
  onChange: (updates: Partial<OfferFormData>) => void;
  isEditable: boolean;
}

/** Чипы + «Своё»: сохранённый нестандартный текст виден как «Своё: …» и не подменяется. */
function TermChips({
  label,
  htmlId,
  chips,
  value,
  onValueChange,
  disabled,
}: {
  label: string;
  htmlId: string;
  chips: readonly OfferTermChip[];
  value: string;
  onValueChange: (value: string) => void;
  disabled: boolean;
}) {
  const selection = matchOfferTerm(chips, value);
  // «Своё» остаётся открытым, пока партнёр редактирует текст, даже если он временно пуст.
  const [customOpen, setCustomOpen] = useState(selection.kind === "custom");
  const showCustom = customOpen || selection.kind === "custom";
  const customText = selection.kind === "custom" ? selection.text : "";

  const items: ChipItem[] = [
    ...chips.map((chip) => ({
      id: chip.id,
      label: chip.label,
      active: selection.kind === "chip" && selection.id === chip.id,
      disabled,
      onClick: () => {
        setCustomOpen(false);
        onValueChange(selection.kind === "chip" && selection.id === chip.id ? "" : chip.value);
      },
    })),
    {
      id: "custom",
      label: selection.kind === "custom" && customText ? `${CUSTOM_TERMS_PREFIX}${customText}` : "Своё",
      active: showCustom,
      disabled,
      onClick: () => {
        if (showCustom) {
          setCustomOpen(false);
          if (selection.kind === "custom") onValueChange("");
        } else {
          setCustomOpen(true);
        }
      },
    },
  ];

  return (
    <div className="space-y-2">
      <Label id={`${htmlId}-label`}>{label}</Label>
      <ChipsRow items={items} layout="wrap" aria-label={label} />
      {showCustom && (
        <Input
          id={htmlId}
          aria-labelledby={`${htmlId}-label`}
          maxLength={460}
          placeholder="Напишите своими словами"
          value={customText}
          onChange={(event) => onValueChange(formatCustomOfferTerm(event.target.value))}
          disabled={disabled}
          className="rounded-xl"
        />
      )}
    </div>
  );
}

/** Блоки «Зона выезда» (праздник с выездом) и «Предоплата и отмена» шага «Условия и контакты». */
export function StepPaymentTerms({ data, onChange, isEditable }: StepPaymentTermsProps) {
  const isParty = data.productType === "PARTY_SERVICE" || data.productType === "PARTY_PACKAGE";
  const locationType = data.birthdayDetails.locationType;
  const showServiceArea = isParty && (locationType === "OFF_SITE" || locationType === "BOTH");
  const showTerms = offerShowsPaymentTerms(data.schedule.bookingMethod);

  if (!showServiceArea && !showTerms) return null;

  return (
    <div className="space-y-8">
      {showServiceArea && (
        <section className="space-y-3" aria-labelledby="terms-area-title">
          <div>
            <h3 id="terms-area-title" className="text-base font-semibold">
              Зона выезда {locationType === "OFF_SITE" && <span className="text-red-500">*</span>}
            </h3>
            <p className="text-sm text-muted-foreground">Куда вы приезжаете: район, город или радиус.</p>
          </div>
          <Input
            id="service-area"
            aria-label="Зона выезда"
            maxLength={SERVICE_AREA_MAX_LENGTH}
            placeholder="Например: Минск и до 20 км"
            value={data.serviceAreaText}
            onChange={(event) => onChange({ serviceAreaText: event.target.value })}
            disabled={!isEditable}
            className="rounded-xl"
          />
        </section>
      )}

      {showTerms && (
        <section className="space-y-5" aria-labelledby="terms-payment-title">
          <div>
            <h3 id="terms-payment-title" className="text-base font-semibold">
              Предоплата и отмена
            </h3>
            <p className="text-sm text-muted-foreground">
              Оплата проходит у вас, через mamaGo платежей нет. Эти условия родители увидят перед заявкой.
            </p>
          </div>
          <TermChips
            label="Предоплата"
            htmlId="terms-prepayment"
            chips={PREPAYMENT_CHIPS}
            value={data.prepaymentTerms}
            onValueChange={(prepaymentTerms) => onChange({ prepaymentTerms })}
            disabled={!isEditable}
          />
          <TermChips
            label="Отмена и возврат"
            htmlId="terms-cancellation"
            chips={CANCELLATION_CHIPS}
            value={data.cancellationTerms}
            onValueChange={(cancellationTerms) => onChange({ cancellationTerms })}
            disabled={!isEditable}
          />
        </section>
      )}
    </div>
  );
}
