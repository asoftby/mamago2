import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StableCardSelector } from "@/components/ui/stable-card-selector";
import { Textarea } from "@/components/ui/textarea";
import type {
  BirthdayLocationType,
  BirthdayRole,
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

const birthdayRoleOptions = [
  { value: "VENUE" as const, label: "Площадка / аренда", description: "Локация, пространство или отдельный зал для праздника." },
  { value: "ANIMATOR" as const, label: "Аниматор / ведущий", description: "Ведущий, герой, аниматор или интерактив." },
  { value: "SHOW" as const, label: "Шоу / программа", description: "Научное, музыкальное, тематическое или игровое шоу." },
  { value: "MASTER_CLASS" as const, label: "Мастер-класс", description: "Творческий или образовательный формат для праздника." },
  { value: "CAKE" as const, label: "Торт / сладкий стол", description: "Кондитерский или сладкий блок праздника." },
  { value: "CATERING" as const, label: "Еда / кейтеринг", description: "Фуршет, закуски, catering или праздничное меню." },
  { value: "DECOR" as const, label: "Декор", description: "Украшение пространства, фотозона, шары и оформление." },
  { value: "PHOTO_VIDEO" as const, label: "Фото / видео", description: "Съёмка, фотограф, видеограф или контент-пакет." },
  { value: "PACKAGE" as const, label: "Праздник под ключ", description: "Полный пакет с программой и организацией." },
  { value: "OTHER" as const, label: "Другое", description: "Нестандартный формат, который тоже релевантен празднику." },
];

const birthdayLocationOptions = [
  { value: "ON_SITE" as const, label: "У нас", description: "Праздник проходит на вашей площадке." },
  { value: "OFF_SITE" as const, label: "С выездом", description: "Вы приезжаете к клиенту или на стороннюю площадку." },
  { value: "BOTH" as const, label: "Оба варианта", description: "Можно провести и у вас, и на выезде." },
];

const partyCategoryOptions = [
  { value: "VENUE" as const, label: "Площадка / аренда", description: "Локация, пространство или отдельный зал для праздника." },
  { value: "ANIMATOR" as const, label: "Аниматор / ведущий", description: "Ведущий, герой, аниматор или интерактив." },
  { value: "SHOW" as const, label: "Шоу / программа", description: "Научное, музыкальное, тематическое или игровое шоу." },
  { value: "MASTER_CLASS" as const, label: "Мастер-класс", description: "Творческий или образовательный формат для праздника." },
  { value: "CAKE" as const, label: "Торт / сладкий стол", description: "Кондитерский или сладкий блок праздника." },
  { value: "FOOD" as const, label: "Еда / кейтеринг", description: "Фуршет, закуски, catering или праздничное меню." },
  { value: "DECOR" as const, label: "Декор", description: "Украшение пространства, фотозона, шары и оформление." },
  { value: "PHOTO" as const, label: "Фото / видео", description: "Съёмка, фотограф, видеограф или контент-пакет." },
  { value: "PROGRAM" as const, label: "Праздник под ключ", description: "Полный пакет с программой и организацией." },
  { value: "OTHER" as const, label: "Другое", description: "Нестандартный формат, который тоже релевантен празднику." },
];

export function Step2Placements({
  data,
  onChange,
  isEditable,
}: Step2PlacementsProps) {
  const hasBirthdayPlacement = data.requestedPlacements.includes("BIRTHDAY");
  const isPartyService = data.productType === "PARTY_SERVICE";
  const showPartySection = isPartyService || hasBirthdayPlacement;

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
          Где это может быть полезно родителям?
        </h2>
        <p className="text-muted-foreground">
          Выберите только те сценарии, для которых у вас есть отдельные условия.
          Финальное размещение проверит модератор.
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

      {showPartySection ? (
        <div className="space-y-6 rounded-3xl border border-[#EF8759]/30 bg-orange-50/60 p-5">
          <div>
            <h3 className="text-lg font-semibold">Условия для праздника</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Заполните базовые условия, чтобы модератор и родители понимали,
              как именно предложение работает в сценарии праздника.
            </p>
          </div>

          <div className="space-y-2">
            <Label>{isPartyService ? "Категория услуги" : "Роль в празднике"} <span className="text-red-500">*</span></Label>
            {isPartyService ? (
              <StableCardSelector<PartyCategory>
                value={data.partyCategory}
                onValueChange={(partyCategory) => onChange({ partyCategory })}
                options={partyCategoryOptions}
                isEditable={isEditable}
                className="grid gap-3 md:grid-cols-2"
              />
            ) : (
              <StableCardSelector<BirthdayRole>
                value={data.birthdayDetails.role}
                onValueChange={(role) => updateBirthdayDetails({ role })}
                options={birthdayRoleOptions}
                isEditable={isEditable}
                className="grid gap-3 md:grid-cols-2"
              />
            )}
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

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
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
            <div className="space-y-2">
              <Label htmlFor="birthdayPriceFrom">
                Цена от <span className="text-red-500">*</span>
              </Label>
              <Input
                id="birthdayPriceFrom"
                inputMode="decimal"
                placeholder="Например, 120"
                value={data.birthdayDetails.priceFrom}
                onChange={(e) =>
                  updateBirthdayDetails({ priceFrom: e.target.value })
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
    </div>
  );
}
