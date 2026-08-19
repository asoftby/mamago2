"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { InternationalPhoneInput } from "@/components/phone/InternationalPhoneInput";
import { PHONE_LABEL_MAX_LENGTH } from "@/lib/phones/normalizePhones";

export interface MultiPhoneFieldsValue {
  phone: string | null;
  label: string | null;
}

export interface MultiPhoneFieldsProps {
  idPrefix: string;
  isEditable?: boolean;
  primary: MultiPhoneFieldsValue;
  secondary: MultiPhoneFieldsValue;
  tertiary: MultiPhoneFieldsValue;
  onChange: (slot: "primary" | "secondary" | "tertiary", value: MultiPhoneFieldsValue) => void;
  primaryFieldLabel?: string;
  primaryPlaceholder?: string;
  hint?: string;
}

/** Реюзаемый блок «до 3 телефонов с подписями» для бизнес-визардов (Place/Offer/Event). */
export function MultiPhoneFields({
  idPrefix,
  isEditable = true,
  primary,
  secondary,
  tertiary,
  onChange,
  primaryFieldLabel = "Основной телефон",
  primaryPlaceholder = "+375 29 123 45 67",
  hint = "Подпись поможет родителям выбрать нужный номер: ресепшен, бронирование, администратор.",
}: MultiPhoneFieldsProps) {
  const [secondaryAdded, setSecondaryAdded] = useState(false);
  const [tertiaryAdded, setTertiaryAdded] = useState(false);

  const showSecondary = secondaryAdded || Boolean(secondary.phone || secondary.label);
  const showTertiary = tertiaryAdded || Boolean(tertiary.phone || tertiary.label);

  const handlePhoneChange = (slot: "primary" | "secondary" | "tertiary", value: string) => {
    const current = slot === "primary" ? primary : slot === "secondary" ? secondary : tertiary;
    onChange(slot, { phone: value || null, label: value ? current.label : null });
  };

  const handleLabelChange = (slot: "primary" | "secondary" | "tertiary", value: string) => {
    const current = slot === "primary" ? primary : slot === "secondary" ? secondary : tertiary;
    const normalized = value.trim().slice(0, PHONE_LABEL_MAX_LENGTH);
    onChange(slot, { phone: current.phone, label: normalized || null });
  };

  const handleAddPhone = () => {
    if (!showSecondary) {
      setSecondaryAdded(true);
      return;
    }
    if (!showTertiary) {
      setTertiaryAdded(true);
    }
  };

  const handleRemoveSecondary = () => {
    onChange("secondary", { phone: null, label: null });
    onChange("tertiary", { phone: null, label: null });
    setSecondaryAdded(false);
    setTertiaryAdded(false);
  };

  const handleRemoveTertiary = () => {
    onChange("tertiary", { phone: null, label: null });
    setTertiaryAdded(false);
  };

  const canAddMorePhones = !showTertiary;

  return (
    <div className="space-y-4">
      <PhoneFieldsRow
        phoneId={`${idPrefix}-phone`}
        labelId={`${idPrefix}-phone-label`}
        phoneLabel={primaryFieldLabel}
        helperLabel="Что это за номер?"
        phoneValue={primary.phone ?? ""}
        labelValue={primary.label ?? ""}
        phonePlaceholder={primaryPlaceholder}
        labelPlaceholder="Например: ресепшен"
        isEditable={isEditable}
        onPhoneChange={(value) => handlePhoneChange("primary", value)}
        onLabelChange={(value) => handleLabelChange("primary", value)}
      />

      {showSecondary ? (
        <PhoneFieldsRow
          phoneId={`${idPrefix}-phone-2`}
          labelId={`${idPrefix}-phone-2-label`}
          phoneLabel="Дополнительный телефон"
          helperLabel="Что это за номер?"
          phoneValue={secondary.phone ?? ""}
          labelValue={secondary.label ?? ""}
          phonePlaceholder="+375 44 123 45 67"
          labelPlaceholder="Например: бронирование, администратор"
          isEditable={isEditable}
          onPhoneChange={(value) => handlePhoneChange("secondary", value)}
          onLabelChange={(value) => handleLabelChange("secondary", value)}
          onRemove={handleRemoveSecondary}
        />
      ) : null}

      {showTertiary ? (
        <PhoneFieldsRow
          phoneId={`${idPrefix}-phone-3`}
          labelId={`${idPrefix}-phone-3-label`}
          phoneLabel="Дополнительный телефон"
          helperLabel="Что это за номер?"
          phoneValue={tertiary.phone ?? ""}
          labelValue={tertiary.label ?? ""}
          phonePlaceholder="+375 33 123 45 67"
          labelPlaceholder="Например: бронирование, администратор"
          isEditable={isEditable}
          onPhoneChange={(value) => handlePhoneChange("tertiary", value)}
          onLabelChange={(value) => handleLabelChange("tertiary", value)}
          onRemove={handleRemoveTertiary}
        />
      ) : null}

      {canAddMorePhones ? (
        <div className="space-y-2">
          <button
            type="button"
            onClick={handleAddPhone}
            disabled={!isEditable}
            className="inline-flex text-sm font-medium text-[#141210] underline decoration-dashed underline-offset-4 transition-opacity hover:opacity-70 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Добавить дополнительный телефон
          </button>
          <p className="mt-2 text-xs text-muted-foreground">
            Можно добавить не больше двух дополнительных номеров.
          </p>
        </div>
      ) : null}

      <p className="text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}

interface PhoneFieldsRowProps {
  phoneId: string;
  labelId: string;
  phoneLabel: string;
  helperLabel: string;
  phoneValue: string;
  labelValue: string;
  phonePlaceholder: string;
  labelPlaceholder: string;
  isEditable: boolean;
  onPhoneChange: (value: string) => void;
  onLabelChange: (value: string) => void;
  onRemove?: () => void;
}

function PhoneFieldsRow({
  phoneId,
  labelId,
  phoneLabel,
  helperLabel,
  phoneValue,
  labelValue,
  phonePlaceholder,
  labelPlaceholder,
  isEditable,
  onPhoneChange,
  onLabelChange,
  onRemove,
}: PhoneFieldsRowProps) {
  return (
    <div className="space-y-3">
      <div className="grid gap-3 md:grid-cols-2 md:items-end">
        <div>
          <Label htmlFor={phoneId}>{phoneLabel}</Label>
        </div>
        <div className="flex items-center justify-between gap-3 md:min-h-[24px]">
          <Label htmlFor={labelId}>{helperLabel}</Label>
          {onRemove ? (
            <Button type="button" variant="ghost" size="sm" onClick={onRemove} disabled={!isEditable}>
              Удалить
            </Button>
          ) : null}
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <InternationalPhoneInput
            id={phoneId}
            value={phoneValue}
            onChange={onPhoneChange}
            placeholder={phonePlaceholder}
            className="mt-2"
            disabled={!isEditable}
          />
        </div>

        <div>
          <Input
            id={labelId}
            value={labelValue}
            onChange={(e) => onLabelChange(e.target.value)}
            placeholder={labelPlaceholder}
            className="mt-2"
            maxLength={PHONE_LABEL_MAX_LENGTH}
            disabled={!isEditable}
          />
        </div>
      </div>
    </div>
  );
}
