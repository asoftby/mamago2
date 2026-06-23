import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StableCardSelector } from "@/components/ui/stable-card-selector";
import { Textarea } from "@/components/ui/textarea";
import type {
  BirthdayLocationType,
  OfferFormData,
  OfferPlacementKey,
  OfferPlacementStatus,
  PartyCategory,
} from "../types";

interface Step2PlacementsProps {
  data: OfferFormData;
  onChange: (
    updates:
      | Partial<OfferFormData>
      | ((prev: OfferFormData) => Partial<OfferFormData>),
  ) => void;
  isEditable: boolean;
}

const placementOptions: Array<{
  key: OfferPlacementKey;
  label: string;
  description: string;
}> = [
  {
    key: "WHERE_TO_GO",
    label: "Просто сходить с ребёнком",
    description: "Подойдёт как идея для семейного визита или досуга.",
  },
  {
    key: "CLASSES",
    label: "Записаться на занятие",
    description: "Есть отдельные условия для обучения, записи или регулярного посещения.",
  },
  {
    key: "BIRTHDAY",
    label: "Организовать праздник",
    description: "Предложение реально подходит для дня рождения или другого детского праздника.",
  },
  {
    key: "CAMPS",
    label: "Каникулы / смена",
    description: "Есть самостоятельные условия для смен, лагеря или интенсивной программы.",
  },
];

const placementStatusLabel: Record<OfferPlacementStatus, string> = {
  REQUESTED: "на проверке",
  APPROVED: "одобрено",
  REJECTED: "отклонено",
};

const birthdayLocationOptions = [
  { value: "ON_SITE" as const, label: "У нас", description: "Праздник проходит на вашей площадке." },
  { value: "OFF_SITE" as const, label: "С выездом", description: "Вы приезжаете к клиенту или на стороннюю площадку." },
  { value: "BOTH" as const, label: "Оба варианта", description: "Можно провести и у вас, и на выезде." },
];

/** Категория услуги для PARTY_SERVICE, сгруппированная по смыслу (StableCardSelector групп не умеет — рисуем 5 отдельных селекторов с общим value). */
const partyCategoryGroups: Array<{
  groupLabel: string;
  options: Array<{ value: PartyCategory; label: string; description: string }>;
}> = [
  {
    groupLabel: "Пространство",
    options: [
      { value: "VENUE", label: "Площадка / аренда", description: "Локация, пространство или отдельный зал для праздника." },
    ],
  },
  {
    groupLabel: "Развлечение",
    options: [
      { value: "ANIMATOR", label: "Аниматор / ведущий", description: "Ведущий, герой, аниматор или интерактив." },
      { value: "SHOW", label: "Шоу / программа", description: "Научное, музыкальное, тематическое или игровое шоу." },
      { value: "MASTER_CLASS", label: "Мастер-класс", description: "Творческий или образовательный формат для праздника." },
    ],
  },
  {
    groupLabel: "Еда",
    options: [
      { value: "CAKE", label: "Торт / сладкий стол", description: "Кондитерский или сладкий блок праздника." },
      { value: "FOOD", label: "Еда / кейтеринг", description: "Фуршет, закуски, catering или праздничное меню." },
    ],
  },
  {
    groupLabel: "Медиа и декор",
    options: [
      { value: "DECOR", label: "Декор", description: "Украшение пространства, фотозона, шары и оформление." },
      { value: "PHOTO", label: "Фото / видео", description: "Съёмка, фотограф, видеограф или контент-пакет." },
    ],
  },
  {
    groupLabel: "Под ключ",
    options: [
      { value: "PROGRAM", label: "Праздник под ключ", description: "Полный пакет с программой и организацией." },
      { value: "OTHER", label: "Другое", description: "Нестандартный формат, который тоже релевантен празднику." },
    ],
  },
];

export function Step2Placements({
  data,
  onChange,
  isEditable,
}: Step2PlacementsProps) {
  const hasBirthdayPlacement = data.requestedPlacements.includes("BIRTHDAY");
  const isPartyService = data.productType === "PARTY_SERVICE";
  const isPartyPackage = data.productType === "PARTY_PACKAGE";

  const togglePlacement = (key: OfferPlacementKey, checked: boolean) => {
    onChange((prev) => {
      const nextRequestedPlacements = checked
        ? Array.from(new Set([...prev.requestedPlacements, key]))
        : prev.requestedPlacements.filter((item) => item !== key);

      return {
        requestedPlacements: nextRequestedPlacements,
      };
    });
  };

  const updateBirthdayDetails = (
    patch: Partial<OfferFormData["birthdayDetails"]>,
  ) => {
    onChange((prev) => ({
      birthdayDetails: {
        ...prev.birthdayDetails,
        ...patch,
      },
    }));
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-semibold mb-2">
          Что вы предлагаете?
        </h2>
        <p className="text-muted-foreground">
          Выберите сценарии — это поможет родителям найти ваше предложение
          в нужном разделе. Финальное размещение проверит модератор.
        </p>
      </div>

      <div className="space-y-3">
        {placementOptions.map((option) => {
          const isChecked = data.requestedPlacements.includes(option.key);
          const placementStatus = data.placementStatuses[option.key];

          return (
            <label
              key={option.key}
              className={`flex cursor-pointer items-start gap-4 rounded-2xl border p-4 transition-colors ${
                isChecked
                  ? "border-[#EF8759] bg-orange-50"
                  : "border-border hover:border-gray-300"
              } ${!isEditable ? "cursor-not-allowed opacity-70" : ""}`}
            >
              <Checkbox
                checked={isChecked}
                disabled={!isEditable}
                onCheckedChange={(checked) =>
                  togglePlacement(option.key, checked === true)
                }
                className="mt-1"
              />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium text-foreground">{option.label}</span>
                  {placementStatus ? (
                    <Badge variant="outline" className="text-xs">
                      {placementStatusLabel[placementStatus]}
                    </Badge>
                  ) : null}
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  {option.description}
                </p>
              </div>
            </label>
          );
        })}
      </div>

      {isPartyService ? (
        <div className="space-y-6 rounded-3xl border border-[#EF8759]/30 bg-orange-50/60 p-5">
          <div>
            <h3 className="text-lg font-semibold">Услуга для праздника</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Категория и формат проведения помогут родителям и модератору
              понять, что именно вы предлагаете.
            </p>
          </div>

          <div className="space-y-4">
            <Label>Категория услуги <span className="text-red-500">*</span></Label>
            {partyCategoryGroups.map((group) => (
              <div key={group.groupLabel} className="space-y-2">
                <Label className="text-sm font-normal text-muted-foreground">
                  {group.groupLabel}
                </Label>
                <StableCardSelector<PartyCategory>
                  value={data.partyCategory}
                  onValueChange={(partyCategory) => onChange({ partyCategory })}
                  options={group.options}
                  isEditable={isEditable}
                  className="grid gap-3 md:grid-cols-2"
                />
              </div>
            ))}
          </div>

          <div className="space-y-2">
            <Label>Формат проведения <span className="text-red-500">*</span></Label>
            <StableCardSelector<BirthdayLocationType>
              value={data.birthdayDetails.locationType}
              onValueChange={(locationType) => updateBirthdayDetails({ locationType })}
              options={birthdayLocationOptions}
              isEditable={isEditable}
              className="grid gap-3 md:grid-cols-3"
            />
          </div>

          <div className="rounded-2xl border border-border/70 bg-white/60 p-4 text-sm text-muted-foreground">
            Длительность, цена, что входит, описание и важные условия — на
            следующих шагах («Условия» и «Цена»).
          </div>
        </div>
      ) : null}

      {isPartyPackage ? (
        <div className="space-y-6 rounded-3xl border border-[#EF8759]/30 bg-orange-50/60 p-5">
          <div>
            <h3 className="text-lg font-semibold">Условия для праздника</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Заполните базовые условия, чтобы модератор и родители понимали,
              как именно предложение работает в сценарии праздника.
            </p>
          </div>

          <div className="space-y-2">
            <Label>Формат проведения</Label>
            <StableCardSelector<BirthdayLocationType>
              value={data.birthdayDetails.locationType}
              onValueChange={(locationType) => updateBirthdayDetails({ locationType })}
              options={birthdayLocationOptions}
              isEditable={isEditable}
              className="grid gap-3 md:grid-cols-3"
            />
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="birthdayDuration">Длительность, минут</Label>
              <Input
                id="birthdayDuration"
                inputMode="numeric"
                value={data.birthdayDetails.durationMinutes ?? ""}
                onChange={(e) =>
                  updateBirthdayDetails({
                    durationMinutes: e.target.value
                      ? Number(e.target.value)
                      : null,
                  })
                }
                disabled={!isEditable}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="birthdayMinChildren">Минимум детей</Label>
              <Input
                id="birthdayMinChildren"
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
              <Label htmlFor="birthdayMaxChildren">Максимум детей</Label>
              <Input
                id="birthdayMaxChildren"
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
            <Label htmlFor="birthdayIncluded">
              Что входит <span className="text-red-500">*</span>
            </Label>
            <Textarea
              id="birthdayIncluded"
              value={data.birthdayDetails.included}
              onChange={(e) =>
                updateBirthdayDetails({ included: e.target.value })
              }
              disabled={!isEditable}
              rows={4}
              placeholder="Например: аренда зала, ведущий, базовый декор, музыка..."
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="birthdayProgram">Описание программы</Label>
            <Textarea
              id="birthdayProgram"
              value={data.birthdayDetails.program}
              onChange={(e) =>
                updateBirthdayDetails({ program: e.target.value })
              }
              disabled={!isEditable}
              rows={4}
              placeholder="Коротко опишите, как проходит праздник или услуга."
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="birthdayNote">Важные условия</Label>
            <Textarea
              id="birthdayNote"
              value={data.birthdayDetails.note}
              onChange={(e) => updateBirthdayDetails({ note: e.target.value })}
              disabled={!isEditable}
              rows={3}
              placeholder="Например: доплата за выезд, минимальный заказ, ограничения по возрасту."
            />
          </div>
        </div>
      ) : null}

      {hasBirthdayPlacement && !isPartyService && !isPartyPackage ? (
        <div className="rounded-2xl border border-border/70 bg-muted/30 p-4 text-sm text-muted-foreground">
          Отметка «Организовать праздник» поможет родителям найти это
          предложение в разделе праздников — дополнительные поля для этого
          сценария не нужны.
        </div>
      ) : null}
    </div>
  );
}
