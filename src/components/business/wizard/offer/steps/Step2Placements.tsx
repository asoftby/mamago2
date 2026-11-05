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
  /** Новый мастер: блок «другие разделы каталога» показывает «О предложении» один раз, здесь он скрыт. */
  showAdditionalPlacements?: boolean;
  /** Context-specific questions in the new six-step wizard; legacy remains unchanged. */
  v2?: boolean;
}

const LOCATION_OPTIONS: Array<{ value: BirthdayLocationType; label: string }> = [
  { value: "ON_SITE", label: "У нас" },
  { value: "OFF_SITE", label: "С выездом" },
  { value: "BOTH", label: "И там, и там" },
];

const SERVICE_OPTIONS: Array<{ value: PartyCategory; label: string }> = [
  { value: "VENUE", label: "Площадка / зал" },
  { value: "ANIMATOR", label: "Аниматор" },
  { value: "SHOW", label: "Шоу" },
  { value: "MASTER_CLASS", label: "Мастер-класс" },
  { value: "CAKE", label: "Торт / сладкий стол" },
  { value: "FOOD", label: "Еда / кейтеринг" },
  { value: "DECOR", label: "Декор" },
  { value: "PHOTO", label: "Фото / видео" },
  { value: "PROGRAM", label: "Программа праздника" },
  { value: "OTHER", label: "Другое" },
];

export function Step2Placements({
  data,
  onChange,
  isEditable,
  showAdditionalPlacements = true,
  v2 = false,
}: Step2PlacementsProps) {
  const isService = data.productType === "PARTY_SERVICE";
  const isPackage = data.productType === "PARTY_PACKAGE";
  const birthday = data.birthdayDetails;
  const orderDelivery = v2 && isService && (data.partyCategory === "CAKE" || data.partyCategory === "FOOD");
  const photoService = v2 && isService && data.partyCategory === "PHOTO";
  const advancedDuration = v2 && isService && (
    data.partyCategory === "CAKE" || data.partyCategory === "FOOD" || data.partyCategory === "DECOR"
  );
  const advancedChildren = v2 && isService && (
    data.partyCategory === "CAKE" || data.partyCategory === "FOOD" ||
    data.partyCategory === "DECOR" || data.partyCategory === "PHOTO"
  );
  // Hidden fields still affect published discovery and server-side selection.
  // Keep previously entered limits visible and removable when changing categories.
  const existingDuration = birthday.durationMinutes != null;
  const existingChildren = birthday.minChildren != null || birthday.maxChildren != null;
  const omitDuration = advancedDuration && !existingDuration;
  const omitChildren = advancedChildren && !existingChildren;
  const locationQuestion = orderDelivery ? "Как получить заказ?" : photoService ? "Где проходит съёмка?" : "Где проходит?";
  const locationOptions = orderDelivery
    ? [{ value: "ON_SITE" as const, label: "Самовывоз" }, { value: "OFF_SITE" as const, label: "Доставка" }, { value: "BOTH" as const, label: "И так, и так" }]
    : photoService
      ? [{ value: "ON_SITE" as const, label: "В студии" }, { value: "OFF_SITE" as const, label: "С выездом" }, { value: "BOTH" as const, label: "И там, и там" }]
      : LOCATION_OPTIONS;
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

      {isService && (!v2 || !data.partyCategory) && (
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

      {isService && data.partyCategory === "ANIMATOR" && <div className="space-y-2">
        <Label>Кто проводит программу?</Label>
        <select aria-label="Кто проводит программу?" className="w-full min-h-11 rounded-xl border px-3 bg-background" disabled={!isEditable}
          value={birthday.performerRole ?? "ANIMATOR"} onChange={e => updateBirthdayDetails({ performerRole: e.target.value as "ANIMATOR" | "HOST" })}>
          <option value="ANIMATOR">Аниматор — игры и развлечения</option><option value="HOST">Ведущий — проведение мероприятия</option>
        </select>
      </div>}
      {(data.partyCategory === "CAKE" || data.partyCategory === "DECOR") && <fieldset className="space-y-3">
        <legend className="text-sm font-medium">Индивидуальные заказы</legend>
        {([{ key: "acceptsCustomOrders", label: "Принимаете заказы по пожеланиям клиента?" }, { key: "acceptsReferences", label: "Можно прислать фотографии желаемого результата?" }] as const).map(question => (
          <label key={question.key} className="block text-sm">{question.label}
            <select className="mt-1 w-full min-h-11 rounded-xl border bg-background px-3" disabled={!isEditable} value={birthday[question.key] == null ? "" : String(birthday[question.key])}
              onChange={e => updateBirthdayDetails({ [question.key]: e.target.value === "" ? null : e.target.value === "true" })}>
              <option value="">Пока не указано</option><option value="true">Да</option><option value="false">Нет</option>
            </select>
          </label>
        ))}
        <p className="text-xs text-muted-foreground">Фотографии клиент прикрепит к своему заказу. Здесь загружать их не нужно.</p>
      </fieldset>}
      <div className="space-y-2">
        <p className="text-sm font-medium">{locationQuestion} <span className="text-destructive">*</span></p>
        <div role="group" aria-label={locationQuestion.replace("?", "")} className="grid grid-cols-3 gap-2">
          {locationOptions.map((option) => (
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

      {((advancedDuration && existingDuration) || (advancedChildren && existingChildren)) && (
        <p className="text-sm text-muted-foreground">
          Сохранённые ограничения влияют на подбор услуги. Измените их или очистите поля, если они больше не нужны.
        </p>
      )}

      {(!omitDuration || !omitChildren) && (
        <PartyDurationCapacityFields
          idPrefix={isService ? "party-service" : "party-package"}
          details={birthday}
          onChange={updateBirthdayDetails}
          isEditable={isEditable}
          showDuration={!omitDuration}
          showChildren={!omitChildren}
        />
      )}

      <div className="space-y-2">
        <Label htmlFor="party-included">{orderDelivery ? "Что входит в заказ?" : "Что входит?"} <span className="text-destructive">*</span></Label>
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
          {isPackage && <div className="space-y-3">
            <p className="text-sm font-medium">Состав готового пакета</p>
            <p className="text-xs text-muted-foreground">Укажите, что входит в пакет. Изменение состава не пересчитывает цену автоматически: стоимость задаётся в разделе «Услуги и цены».</p>
            {!data.packageComponents?.length && birthday.includedCategories.length > 0 && <p className="text-sm">Прежний состав: {birthday.includedCategories.map(c => SERVICE_OPTIONS.find(o => o.value === c)?.label ?? c).join(", ")}. Он сохранён, пока вы не зададите позиции ниже.</p>}
            {data.persistedOfferStatus === "PUBLISHED" && <p className="text-sm">Изменение состава опубликованного пакета требует согласования. Текущие позиции сохранены.</p>}
            {(data.packageComponents ?? []).map((component, index) => <div key={component.id ?? index} className="grid gap-2 rounded-xl border p-3 sm:grid-cols-[1fr_1fr_auto]">
              <label className="text-sm">Услуга<select className="mt-1 min-h-11 w-full rounded-lg border bg-background px-2" disabled={!isEditable || data.persistedOfferStatus === "PUBLISHED"} value={component.category}
                onChange={e => onChange({ packageComponentsEdited: true, packageComponents: data.packageComponents!.map((c, i) => i === index ? { ...c, category: e.target.value as PartyCategory } : c) })}>
                {SERVICE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select></label>
              <label className="text-sm">Что входит<input className="mt-1 min-h-11 w-full rounded-lg border bg-background px-2" value={component.title} disabled={!isEditable || data.persistedOfferStatus === "PUBLISHED"} maxLength={200}
                onChange={e => onChange({ packageComponentsEdited: true, packageComponents: data.packageComponents!.map((c, i) => i === index ? { ...c, title: e.target.value } : c) })} /></label>
              <button type="button" className="min-h-11 text-sm underline" disabled={!isEditable || data.persistedOfferStatus === "PUBLISHED"} onClick={() => onChange({ packageComponentsEdited: true, packageComponents: data.packageComponents!.filter((_, i) => i !== index) })}>Убрать из состава</button>
            </div>)}
            <button type="button" className="min-h-11 text-sm underline" disabled={!isEditable || data.persistedOfferStatus === "PUBLISHED" || (data.packageComponents?.length ?? 0) >= 30}
              onClick={() => onChange({ packageComponentsEdited: true, packageComponents: [...(data.packageComponents ?? []), { title: "", category: "OTHER" }] })}>Добавить позицию пакета</button>
          </div>}
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
          {showAdditionalPlacements ? (
            <AdditionalPlacements data={data} onChange={onChange} isEditable={isEditable} />
          ) : null}
        </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
