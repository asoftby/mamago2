// Step 4: Format and Conditions
// Inherits Event Wizard Step4DateTime pattern

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { StableCardSelector } from "@/components/ui/stable-card-selector";
import type { OfferFormData, PlaceAmenityKey, PartyOccasion } from "../types";

interface Step4ConditionsProps {
  data: OfferFormData;
  onChange: (updates: Partial<OfferFormData>) => void;
  isEditable: boolean;
}

export function Step4Conditions({ data, onChange, isEditable }: Step4ConditionsProps) {
  const isActivityProduct =
    data.productType === "ONE_TIME_ACTIVITY" ||
    data.productType === "REGULAR_ACTIVITY";
  const isVisitProduct = data.productType === "PLACE_VISIT";

  const AMENITY_OPTIONS: { key: PlaceAmenityKey; label: string }[] = [
    { key: "parking", label: "Парковка" },
    { key: "cafe", label: "Кафе / буфет" },
    { key: "stroller", label: "Можно с коляской" },
    { key: "changing_table", label: "Пеленальный столик" },
  ];

  const renderPlaceVisitFields = () => {
    const { entryModel, amenities } = data.placeVisitDetails;

    const toggleAmenity = (key: PlaceAmenityKey, checked: boolean) => {
      const next = checked
        ? [...amenities, key]
        : amenities.filter((a) => a !== key);
      onChange({ placeVisitDetails: { ...data.placeVisitDetails, amenities: next } });
    };

    return (
      <div className="space-y-6">
        <div className="space-y-3">
          <Label>Вход</Label>
          <StableCardSelector
            value={entryModel}
            onValueChange={(v: "free" | "paid") =>
              onChange({ placeVisitDetails: { ...data.placeVisitDetails, entryModel: v } })
            }
            options={[
              { value: "free" as const, label: "Бесплатный", description: "Посещение без входного билета" },
              { value: "paid" as const, label: "Платный", description: "Требуется входной билет / плата за вход" },
            ]}
            isEditable={isEditable}
            className="grid grid-cols-2 gap-3"
          />
        </div>

        <div className="space-y-3">
          <Label>Удобства</Label>
          <div className="grid grid-cols-2 gap-3">
            {AMENITY_OPTIONS.map(({ key, label }) => (
              <label
                key={key}
                className="flex cursor-pointer items-center gap-2 rounded-xl border border-border/70 px-3 py-2.5 text-sm hover:bg-muted/40"
              >
                <Checkbox
                  checked={amenities.includes(key)}
                  onCheckedChange={(checked) => toggleAmenity(key, Boolean(checked))}
                  disabled={!isEditable}
                />
                {label}
              </label>
            ))}
          </div>
        </div>
      </div>
    );
  };

  const renderClassFields = () => (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="classDuration">
          Продолжительность занятия <span className="text-red-500">*</span>
        </Label>
        <Input
          id="classDuration"
          placeholder="Например: 60 минут, 1.5 часа"
          value={data.classDuration}
          onChange={(e) => onChange({ classDuration: e.target.value })}
          disabled={!isEditable}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="classGroupSize">Размер группы</Label>
        <Input
          id="classGroupSize"
          placeholder="Например: до 8 человек, индивидуально"
          value={data.classGroupSize}
          onChange={(e) => onChange({ classGroupSize: e.target.value })}
          disabled={!isEditable}
        />
      </div>

      <div className="space-y-2">
        <Label>
          Формат занятия <span className="text-red-500">*</span>
        </Label>
        <StableCardSelector
          value={data.classFormat}
          onValueChange={(format: "trial" | "course" | "subscription") => onChange({ classFormat: format })}
          options={[
            { 
              value: "trial" as const, 
              label: "Пробное", 
              description: "Разовое пробное занятие" 
            },
            { 
              value: "course" as const, 
              label: "Курс", 
              description: "Серия занятий с программой" 
            },
            { 
              value: "subscription" as const, 
              label: "Абонемент", 
              description: "Гибкое посещение по абонементу" 
            },
          ]}
          isEditable={isEditable}
          className="grid grid-cols-3 gap-3"
        />
      </div>
    </div>
  );

  const updateBirthdayDetails = (
    patch: Partial<OfferFormData["birthdayDetails"]>,
  ) => {
    onChange({ birthdayDetails: { ...data.birthdayDetails, ...patch } });
  };

  /** PARTY_SERVICE: длительность/вместимость/описательные поля — перенесены сюда со шага «Сценарии». */
  const renderServiceDetailFields = () => (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="serviceDuration">Длительность, минут</Label>
          <Input
            id="serviceDuration"
            inputMode="numeric"
            value={data.birthdayDetails.durationMinutes ?? ""}
            onChange={(e) =>
              updateBirthdayDetails({
                durationMinutes: e.target.value ? Number(e.target.value) : null,
              })
            }
            disabled={!isEditable}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="serviceMinChildren">Минимум детей</Label>
          <Input
            id="serviceMinChildren"
            inputMode="numeric"
            value={data.birthdayDetails.minChildren ?? ""}
            onChange={(e) =>
              updateBirthdayDetails({
                minChildren: e.target.value ? Number(e.target.value) : null,
              })
            }
            disabled={!isEditable}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="serviceMaxChildren">Максимум детей</Label>
          <Input
            id="serviceMaxChildren"
            inputMode="numeric"
            value={data.birthdayDetails.maxChildren ?? ""}
            onChange={(e) =>
              updateBirthdayDetails({
                maxChildren: e.target.value ? Number(e.target.value) : null,
              })
            }
            disabled={!isEditable}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="serviceIncluded">
          Что входит <span className="text-red-500">*</span>
        </Label>
        <Textarea
          id="serviceIncluded"
          value={data.birthdayDetails.included}
          onChange={(e) => updateBirthdayDetails({ included: e.target.value })}
          disabled={!isEditable}
          rows={4}
          placeholder="Например: аренда зала, ведущий, базовый декор, музыка..."
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="serviceProgram">Описание программы</Label>
        <Textarea
          id="serviceProgram"
          value={data.birthdayDetails.program}
          onChange={(e) => updateBirthdayDetails({ program: e.target.value })}
          disabled={!isEditable}
          rows={4}
          placeholder="Коротко опишите, как проходит праздник или услуга."
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="serviceNote">Важные условия</Label>
        <Textarea
          id="serviceNote"
          value={data.birthdayDetails.note}
          onChange={(e) => updateBirthdayDetails({ note: e.target.value })}
          disabled={!isEditable}
          rows={3}
          placeholder="Например: доплата за выезд, минимальный заказ, ограничения по возрасту."
        />
      </div>
    </div>
  );

  const OCCASION_OPTIONS: { key: PartyOccasion; label: string }[] = [
    { key: "BIRTHDAY", label: "День рождения" },
    { key: "GRADUATION", label: "Выпускной" },
  ];

  const renderOccasionsSection = () => {
    const toggleOccasion = (key: PartyOccasion, checked: boolean) => {
      const next = checked
        ? Array.from(new Set([...data.occasions, key]))
        : data.occasions.filter((o) => o !== key);
      onChange({ occasions: next });
    };

    return (
      <div className="space-y-2">
        <Label>Для каких праздников подходит</Label>
        <div className="flex flex-wrap gap-4">
          {OCCASION_OPTIONS.map(({ key, label }) => (
            <label key={key} className="flex items-center gap-2 cursor-pointer">
              <Checkbox
                checked={data.occasions.includes(key)}
                onCheckedChange={(checked) => toggleOccasion(key, checked === true)}
                disabled={!isEditable}
              />
              <span className="text-sm">{label}</span>
            </label>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold mb-2">Формат и условия</h2>
        <p className="text-muted-foreground">
          Детали предложения в зависимости от выбранного типа
        </p>
      </div>

      {!data.offerKind && (
        <div className="text-center py-8 text-muted-foreground">
          <p>Сначала выберите тип предложения на предыдущих шагах</p>
        </div>
      )}

      {isActivityProduct && renderClassFields()}

      {isVisitProduct ? renderPlaceVisitFields() : null}

      {data.productType === "PARTY_SERVICE" ? (
        <div className="space-y-4">
          {renderServiceDetailFields()}
          {renderOccasionsSection()}
        </div>
      ) : null}

      {data.productType === "PARTY_PACKAGE" ? (
        <div className="space-y-4">
          <div className="rounded-2xl border border-border/70 bg-muted/30 p-4 text-sm text-muted-foreground">
            Основные условия для праздника уже задаются на шаге со сценариями
            размещения. Здесь можно оставить дополнительные пояснения в общем
            описании и блоке цены.
          </div>
          {renderOccasionsSection()}
        </div>
      ) : null}
    </div>
  );
}
