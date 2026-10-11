"use client";

import { useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { AdditionalPlacements } from "../components/AdditionalPlacements";
import { PartyDurationCapacityFields } from "../components/PartyDurationCapacityFields";
import type { BirthdayLocationType, OfferFormData, PartyCategory, PartyOccasion } from "../types";

interface Step2PlacementsProps {
  data: OfferFormData;
  onChange: (
    updates: Partial<OfferFormData> | ((prev: OfferFormData) => Partial<OfferFormData>),
  ) => void;
  isEditable: boolean;
}

const LOCATION_OPTIONS: Array<{ value: BirthdayLocationType; label: string }> = [
  { value: "ON_SITE", label: "У нас" },
  { value: "OFF_SITE", label: "С выездом" },
  { value: "BOTH", label: "И там, и там" },
];

const SERVICE_OPTIONS: Array<{ value: PartyCategory; label: string }> = [
  { value: "VENUE", label: "Площадка / зал" },
  { value: "ANIMATOR", label: "Аниматор / ведущий" },
  { value: "SHOW", label: "Шоу" },
  { value: "MASTER_CLASS", label: "Мастер-класс" },
  { value: "CAKE", label: "Торт / сладкий стол" },
  { value: "FOOD", label: "Еда / кейтеринг" },
  { value: "DECOR", label: "Декор" },
  { value: "PHOTO", label: "Фото / видео" },
  { value: "PROGRAM", label: "Программа праздника" },
  { value: "OTHER", label: "Другое" },
];

export function Step2Placements({ data, onChange, isEditable }: Step2PlacementsProps) {
  const isService = data.productType === "PARTY_SERVICE";
  const isPackage = data.productType === "PARTY_PACKAGE";
  const birthday = data.birthdayDetails;
  const [showMore, setShowMore] = useState(false);
  const hasAdditionalData = Boolean(
    birthday.program.trim() || birthday.note.trim() || birthday.includedCategories.length ||
    birthday.prepaymentTerms.trim() || birthday.cancellationTerms.trim() ||
    data.occasions.length || data.requestedPlacements.length > 1,
  );
  const moreOpen = showMore;

  const updateBirthdayDetails = (patch: Partial<OfferFormData["birthdayDetails"]>) => {
    onChange((prev) => ({ birthdayDetails: { ...prev.birthdayDetails, ...patch } }));
  };

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h2 className="text-xl font-semibold text-foreground">{isService ? "Об услуге" : "О празднике"}</h2>
        <p className="text-sm text-muted-foreground">Укажите основные условия. Остальное — по желанию.</p>
      </div>

      {isService && (
        <div className="space-y-2">
          <p className="text-sm font-medium">Какая услуга? <span className="text-destructive">*</span></p>
          <div role="group" aria-label="Вид услуги" className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {SERVICE_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                disabled={!isEditable}
                aria-pressed={data.partyCategory === option.value}
                onClick={() => onChange({ partyCategory: option.value })}
                className={cn(
                  "min-h-11 rounded-xl border px-3 py-2 text-left text-sm transition-colors",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60",
                  data.partyCategory === option.value
                    ? "border-[#EF8759] bg-[#EF8759]/10 font-medium"
                    : "border-border bg-card hover:border-[#EF8759]/70",
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-2">
        <p className="text-sm font-medium">Где проходит? <span className="text-destructive">*</span></p>
        <div role="group" aria-label="Где проходит" className="grid grid-cols-3 gap-2">
          {LOCATION_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              aria-pressed={birthday.locationType === option.value}
              disabled={!isEditable}
              onClick={() => updateBirthdayDetails({ locationType: option.value })}
              className={cn(
                "flex min-h-11 items-center justify-center gap-1 rounded-xl border px-2 py-2 text-center text-sm transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60",
                birthday.locationType === option.value
                  ? "border-[#EF8759] bg-[#EF8759]/10 font-medium"
                  : "border-border bg-card hover:border-[#EF8759]/70",
              )}
            >
              {birthday.locationType === option.value && <Check aria-hidden="true" className="size-3.5 shrink-0" />}
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <PartyDurationCapacityFields
        idPrefix={isService ? "party-service" : "party-package"}
        details={birthday}
        onChange={updateBirthdayDetails}
        isEditable={isEditable}
      />

      <div className="space-y-2">
        <Label htmlFor="party-included">Что входит? <span className="text-destructive">*</span></Label>
        <Textarea
          id="party-included"
          value={birthday.included}
          onChange={(event) => updateBirthdayDetails({ included: event.target.value })}
          disabled={!isEditable}
          rows={3}
          placeholder={isService ? "Например: час работы аниматора, реквизит" : "Например: аренда зала, ведущий, музыка, украшение"}
        />
        {!birthday.included.trim() && birthday.program.trim() && (
          <p className="text-xs text-muted-foreground">Описание уже есть в дополнительных сведениях.</p>
        )}
      </div>

      <Collapsible open={moreOpen} onOpenChange={setShowMore}>
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="flex w-full items-center justify-between rounded-xl border border-border/70 bg-muted/20 px-4 py-3 text-left text-sm font-medium hover:bg-muted/40"
          >
            Дополнительно{hasAdditionalData ? " · заполнено" : ""}
            <ChevronDown aria-hidden="true" className={cn("size-4 transition-transform", moreOpen && "rotate-180")} />
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="space-y-5 pt-4">
          {isPackage && (
            <div className="space-y-2">
              <p className="text-sm font-medium">Состав готового пакета</p>
              <p className="text-xs text-muted-foreground">Отметьте услуги, которые входят в цену.</p>
              <div className="grid grid-cols-2 gap-3">
                {SERVICE_OPTIONS.filter((option) => option.value !== "PROGRAM" && option.value !== "OTHER").map((option) => (
                  <label key={option.value} className="flex cursor-pointer items-center gap-2 text-sm">
                    <Checkbox
                      checked={birthday.includedCategories.includes(option.value)}
                      disabled={!isEditable}
                      onCheckedChange={(checked) => {
                        const list = checked === true
                          ? Array.from(new Set([...birthday.includedCategories, option.value]))
                          : birthday.includedCategories.filter((value) => value !== option.value);
                        updateBirthdayDetails({ includedCategories: list });
                      }}
                    />
                    <span>{option.label}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="party-program">Программа праздника</Label>
            <Textarea id="party-program" rows={3} value={birthday.program}
              onChange={(event) => updateBirthdayDetails({ program: event.target.value })}
              disabled={!isEditable} placeholder="Если нужна отдельная программа по этапам" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="party-note">Особые условия</Label>
            <Textarea id="party-note" rows={2} value={birthday.note}
              onChange={(event) => updateBirthdayDetails({ note: event.target.value })}
              disabled={!isEditable} placeholder="Например: стоимость выезда за город" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="party-prepayment">Предоплата</Label>
            <Textarea id="party-prepayment" rows={2} value={birthday.prepaymentTerms}
              onChange={(event) => updateBirthdayDetails({ prepaymentTerms: event.target.value })}
              disabled={!isEditable} placeholder="Например: 30% после подтверждения" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="party-cancellation">Отмена и возврат</Label>
            <Textarea id="party-cancellation" rows={2} value={birthday.cancellationTerms}
              onChange={(event) => updateBirthdayDetails({ cancellationTerms: event.target.value })}
              disabled={!isEditable} placeholder="Например: возврат при отмене за 7 дней" />
          </div>
          <div className="space-y-2">
            <p className="text-sm font-medium">Другие поводы</p>
            <div className="flex flex-wrap gap-4">
              {([{ key: "BIRTHDAY", label: "День рождения" }, { key: "GRADUATION", label: "Выпускной" }] as Array<{ key: PartyOccasion; label: string }>).map((occasion) => (
                <label key={occasion.key} className="flex items-center gap-2 text-sm">
                  <Checkbox checked={data.occasions.includes(occasion.key)} disabled={!isEditable}
                    onCheckedChange={(checked) => onChange({ occasions: checked === true
                      ? Array.from(new Set([...data.occasions, occasion.key]))
                      : data.occasions.filter((key) => key !== occasion.key) })} />
                  {occasion.label}
                </label>
              ))}
            </div>
          </div>
          <AdditionalPlacements data={data} onChange={onChange} isEditable={isEditable} />
        </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
