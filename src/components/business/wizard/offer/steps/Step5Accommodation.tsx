// Step 5: Размещение (CAMP)

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { WizardRichTextField } from "@/components/business/wizard/shared/WizardRichTextField";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { CampLodgingTypeKey, CampMealKey, OfferFormData } from "../types";
import {
  CAMP_LODGING_TYPE_OPTIONS,
  CAMP_MEAL_OPTIONS,
  campImpliesLodging,
  showCampLodgingFormFields,
} from "../campOfferModel";

interface Step5AccommodationProps {
  data: OfferFormData;
  onChange: (updates: Partial<OfferFormData>) => void;
  isEditable: boolean;
}

export function Step5Accommodation({ data, onChange, isEditable }: Step5AccommodationProps) {
  const lodgingRequired = campImpliesLodging(data.campProgramType);
  const showForm = showCampLodgingFormFields(data);

  const toggleMeal = (key: CampMealKey, checked: boolean) => {
    const set = new Set(data.campIncludedMeals);
    if (checked) set.add(key);
    else set.delete(key);
    onChange({ campIncludedMeals: Array.from(set) as CampMealKey[] });
  };

  return (
    <div className="space-y-8">
      <div className="space-y-1">
        <h2 className="text-xl font-semibold tracking-tight text-foreground">Размещение</h2>
        <p className="text-sm text-muted-foreground leading-relaxed max-w-2xl">
          Спокойно опишите быт и безопасность — это снимает типовые вопросы родителей ещё до
          звонка вам.
        </p>
      </div>

      {!lodgingRequired && (
        <Card className="rounded-2xl border border-border/70 shadow-sm">
          <CardContent className="p-4 sm:p-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-1 min-w-0">
                <p className="text-sm font-medium text-foreground">Есть проживание</p>
                <p className="text-xs text-muted-foreground">
                  Включите, если для этой программы нужен блок про размещение
                </p>
              </div>
              <Switch
                checked={data.accommodationProvided}
                onCheckedChange={(v) => onChange({ accommodationProvided: v })}
                disabled={!isEditable}
                className="shrink-0"
              />
            </div>
          </CardContent>
        </Card>
      )}

      {lodgingRequired && (
        <div className="rounded-2xl border border-dashed border-border/70 bg-muted/15 px-4 py-3 text-sm text-muted-foreground">
          Для выездной и смешанной программы блок размещения показывается по умолчанию — так
          родителям проще понять полный формат.
        </div>
      )}

      {!showForm ? (
        <Card className="rounded-2xl border border-border/60 bg-card">
          <CardContent className="p-6 sm:p-8">
            <p className="text-sm leading-relaxed text-muted-foreground text-center max-w-md mx-auto">
              Для городского лагеря размещение обычно не требуется. Если по вашей программе есть
              ночёвка или корпус — включите «Есть проживание» выше.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          <div className="space-y-2">
            <Label>Тип размещения</Label>
            <Select
              value={data.accommodationType || ""}
              onValueChange={(v) =>
                onChange({ accommodationType: v as CampLodgingTypeKey })
              }
              disabled={!isEditable}
            >
              <SelectTrigger className="w-full rounded-xl h-11">
                <SelectValue placeholder="Выберите тип" />
              </SelectTrigger>
              <SelectContent>
                {CAMP_LODGING_TYPE_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="accommodationAddress">Адрес проживания</Label>
            <Input
              id="accommodationAddress"
              placeholder="Город, улица, ориентир — как добраться"
              value={data.accommodationAddress}
              onChange={(e) => onChange({ accommodationAddress: e.target.value })}
              disabled={!isEditable}
              className="rounded-xl h-11"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="accommodationRooms">Комнаты и расселение</Label>
            <Textarea
              id="accommodationRooms"
              placeholder="Сколько человек в комнате, душ/туалет, что на территории…"
              value={data.accommodationRooms}
              onChange={(e) => onChange({ accommodationRooms: e.target.value })}
              disabled={!isEditable}
              rows={5}
              className="rounded-xl min-h-[140px] resize-y"
            />
          </div>

          <Card className="rounded-2xl border border-border/60 shadow-sm">
            <CardContent className="p-4 sm:p-5 space-y-3">
              <Label className="text-base">Питание</Label>
              <p className="text-xs text-muted-foreground -mt-1">
                Отметьте, что входит в программу
              </p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {CAMP_MEAL_OPTIONS.map((m) => {
                  const checked = data.campIncludedMeals.includes(m.value);
                  return (
                    <label
                      key={m.value}
                      className={cn(
                        "flex items-center gap-3 rounded-xl border border-border/50 px-3 py-2.5 cursor-pointer",
                        "hover:bg-muted/30 transition-colors",
                        !isEditable && "pointer-events-none opacity-60",
                      )}
                    >
                      <Checkbox
                        checked={checked}
                        onCheckedChange={(v) => toggleMeal(m.value, v === true)}
                        disabled={!isEditable}
                      />
                      <span className="text-sm">{m.label}</span>
                    </label>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          <div className="space-y-2">
            <WizardRichTextField
              label="Условия"
              helperText="Режим, правила, уборка, доступ взрослых на территорию и другие важные детали."
              value={data.accommodationConditions}
              onChange={(value) => onChange({ accommodationConditions: value })}
              placeholder="Режим, правила, уборка, доступ взрослых на территорию…"
              disabled={!isEditable}
              minHeight={140}
            />
          </div>

          <div className="space-y-2">
            <WizardRichTextField
              label="Что взять с собой"
              helperText="Документы, одежда, средства гигиены и другие обязательные вещи."
              value={data.whatToBring}
              onChange={(value) => onChange({ whatToBring: value })}
              placeholder="Документы, одежда по погоде, средства гигиены…"
              disabled={!isEditable}
              minHeight={140}
            />
          </div>

          <div className="space-y-2">
            <WizardRichTextField
              label="Безопасность"
              helperText="Охрана, пропускной режим и сопровождение детей на активностях."
              value={data.campSafetyInfo}
              onChange={(value) => onChange({ campSafetyInfo: value })}
              placeholder="Охрана, пропускной режим, сопровождение на мероприятиях…"
              disabled={!isEditable}
              minHeight={140}
            />
          </div>

          <div className="space-y-2">
            <WizardRichTextField
              label="Медицинское сопровождение"
              helperText="Первая помощь, врач или медсестра на смене, хранение лекарств."
              value={data.campMedicalInfo}
              onChange={(value) => onChange({ campMedicalInfo: value })}
              placeholder="Медсестра/врач на смене, первая помощь, хранение лекарств…"
              disabled={!isEditable}
              minHeight={140}
            />
          </div>
        </div>
      )}
    </div>
  );
}
