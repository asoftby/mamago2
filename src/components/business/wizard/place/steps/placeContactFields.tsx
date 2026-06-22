"use client";

import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { InternationalPhoneInput } from "@/components/phone/InternationalPhoneInput";
import type { PlaceFormData } from "../types";
import { PLACE_PHONE_LABEL_MAX_LENGTH } from "@/lib/place/placePhones";

export interface PlaceContactFieldsSharedProps {
  data: PlaceFormData;
  onChange: (updates: Partial<PlaceFormData>) => void;
  isEditable?: boolean;
}

/** Телефон и сайт — шаг Place «Контакты» (как в Step3Contacts). */
export function PlacePhoneWebsiteFields({
  data,
  onChange,
  isEditable = true,
}: PlaceContactFieldsSharedProps) {
  const [showPhone2, setShowPhone2] = useState(Boolean(data.phone2 || data.phone2Label));
  const [showPhone3, setShowPhone3] = useState(Boolean(data.phone3 || data.phone3Label));

  useEffect(() => {
    if (data.phone2 || data.phone2Label) {
      setShowPhone2(true);
    }
  }, [data.phone2, data.phone2Label]);

  useEffect(() => {
    if (data.phone3 || data.phone3Label) {
      setShowPhone2(true);
      setShowPhone3(true);
    }
  }, [data.phone3, data.phone3Label]);

  const handlePhonePairChange = (
    phoneKey: "phone" | "phone2" | "phone3",
    labelKey: "phoneLabel" | "phone2Label" | "phone3Label",
    value: string,
  ) => {
    onChange({
      [phoneKey]: value || null,
      [labelKey]: value ? data[labelKey] : null,
    } as Partial<PlaceFormData>);
  };

  const handlePhoneLabelChange = (
    key: "phoneLabel" | "phone2Label" | "phone3Label",
    value: string,
  ) => {
    const normalized = value.trim().slice(0, PLACE_PHONE_LABEL_MAX_LENGTH);
    onChange({ [key]: normalized || null } as Partial<PlaceFormData>);
  };

  const handleAddPhone = () => {
    if (!showPhone2) {
      setShowPhone2(true);
      return;
    }
    if (!showPhone3) {
      setShowPhone3(true);
    }
  };

  const handleRemovePhone2 = () => {
    onChange({
      phone2: null,
      phone2Label: null,
      phone3: null,
      phone3Label: null,
    });
    setShowPhone2(false);
    setShowPhone3(false);
  };

  const handleRemovePhone3 = () => {
    onChange({
      phone3: null,
      phone3Label: null,
    });
    setShowPhone3(false);
  };

  const canAddMorePhones = !showPhone3;

  return (
    <>
      <div className="space-y-4">
        <PhoneFieldsRow
          phoneId="place-phone"
          labelId="place-phone-label"
          phoneLabel="Основной телефон"
          helperLabel="Что это за номер?"
          phoneValue={data.phone ?? ""}
          labelValue={data.phoneLabel ?? ""}
          phonePlaceholder="+375 29 123 45 67"
          labelPlaceholder="Например: ресепшен"
          isEditable={isEditable}
          onPhoneChange={(value) => handlePhonePairChange("phone", "phoneLabel", value)}
          onLabelChange={(value) => handlePhoneLabelChange("phoneLabel", value)}
        />

        {showPhone2 ? (
          <PhoneFieldsRow
            phoneId="place-phone-2"
            labelId="place-phone-2-label"
            phoneLabel="Дополнительный телефон"
            helperLabel="Что это за номер?"
            phoneValue={data.phone2 ?? ""}
            labelValue={data.phone2Label ?? ""}
            phonePlaceholder="+375 44 123 45 67"
            labelPlaceholder="Например: бронирование, администратор, отдел праздников"
            isEditable={isEditable}
            onPhoneChange={(value) => handlePhonePairChange("phone2", "phone2Label", value)}
            onLabelChange={(value) => handlePhoneLabelChange("phone2Label", value)}
            onRemove={handleRemovePhone2}
          />
        ) : null}

        {showPhone3 ? (
          <PhoneFieldsRow
            phoneId="place-phone-3"
            labelId="place-phone-3-label"
            phoneLabel="Дополнительный телефон"
            helperLabel="Что это за номер?"
            phoneValue={data.phone3 ?? ""}
            labelValue={data.phone3Label ?? ""}
            phonePlaceholder="+375 33 123 45 67"
            labelPlaceholder="Например: бронирование, администратор, отдел праздников"
            isEditable={isEditable}
            onPhoneChange={(value) => handlePhonePairChange("phone3", "phone3Label", value)}
            onLabelChange={(value) => handlePhoneLabelChange("phone3Label", value)}
            onRemove={handleRemovePhone3}
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

        <p className="text-xs text-muted-foreground">
          Подпись поможет родителям выбрать нужный номер: ресепшен, бронирование,
          администратор или отдел праздников.
        </p>
      </div>

      <div>
        <Label htmlFor="place-website">Веб-сайт</Label>
        <Input
          id="place-website"
          type="url"
          value={data.website ?? ""}
          onChange={(e) => onChange({ website: e.target.value })}
          placeholder="https://example.com"
          className="mt-2"
          disabled={!isEditable}
        />
        <p className="text-xs text-muted-foreground mt-1">Необязательно, но рекомендуется</p>
      </div>
    </>
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
            maxLength={PLACE_PHONE_LABEL_MAX_LENGTH}
            disabled={!isEditable}
          />
        </div>
      </div>
    </div>
  );
}

/** Instagram — единственная «соцсеть» в текущей схеме Place. */
export function PlaceInstagramField({
  data,
  onChange,
  isEditable = true,
}: PlaceContactFieldsSharedProps) {
  const handleInstagramChange = (value: string) => {
    let normalized = value.trim();
    if (normalized.startsWith("@")) {
      normalized = normalized.slice(1);
    }
    if (normalized.includes("instagram.com/")) {
      normalized = normalized.split("instagram.com/")[1].split("/")[0];
    }
    onChange({
      instagramHandle: normalized,
      instagramUrl: normalized ? `https://instagram.com/${normalized}` : null,
    });
  };

  const instagram = data.instagramHandle ?? "";

  return (
    <div>
      <Label htmlFor="place-instagram">Instagram</Label>
      <div className="mt-2 flex gap-2">
        <Input
          id="place-instagram"
          value={instagram}
          onChange={(e) => handleInstagramChange(e.target.value)}
          placeholder="@username или ссылка"
          className="flex-1"
          disabled={!isEditable}
        />
        {instagram ? (
          <Button
            type="button"
            variant="outline"
            onClick={() => window.open(`https://instagram.com/${instagram}`, "_blank")}
          >
            Открыть
          </Button>
        ) : null}
      </div>
      {instagram ? (
        <p className="text-xs text-muted-foreground mt-1">instagram.com/{instagram}</p>
      ) : null}
    </div>
  );
}
