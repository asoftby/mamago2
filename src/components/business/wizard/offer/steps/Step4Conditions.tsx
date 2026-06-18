// Step 4: Format and Conditions
// Inherits Event Wizard Step4DateTime pattern

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StableCardSelector } from "@/components/ui/stable-card-selector";
import { WizardRichTextField } from "@/components/business/wizard/shared/WizardRichTextField";
import type { OfferFormData } from "../types";

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
  const isPartyProduct =
    data.productType === "PARTY_SERVICE" ||
    data.productType === "PARTY_PACKAGE";

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

  const renderPartyFields = () => (
    <div className="space-y-4">
      <div className="space-y-2">
        <WizardRichTextField
          label="Программа праздника"
          required
          helperText="Игры, развлечения, мастер-классы и другие ключевые элементы программы."
          value={data.partyProgram}
          onChange={(value) => onChange({ partyProgram: value })}
          placeholder="Опишите программу: игры, развлечения, мастер-классы..."
          disabled={!isEditable}
          minHeight={140}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="partyDuration">
          Продолжительность <span className="text-red-500">*</span>
        </Label>
        <Input
          id="partyDuration"
          placeholder="Например: 2 часа, 3 часа"
          value={data.partyDuration}
          onChange={(e) => onChange({ partyDuration: e.target.value })}
          disabled={!isEditable}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="partyChildrenCount">Количество детей</Label>
        <Input
          id="partyChildrenCount"
          placeholder="Например: до 10 детей, от 5 до 15"
          value={data.partyChildrenCount}
          onChange={(e) => onChange({ partyChildrenCount: e.target.value })}
          disabled={!isEditable}
        />
      </div>

      <div className="space-y-2">
        <WizardRichTextField
          label="Что включено"
          helperText="Коротко перечислите, что уже входит в пакет."
          value={data.partyIncluded}
          onChange={(value) => onChange({ partyIncluded: value })}
          placeholder="Например: украшение зала, торт, подарки..."
          disabled={!isEditable}
          minHeight={140}
        />
      </div>
    </div>
  );

  const renderServiceFields = () => (
    <div className="space-y-4">
      <div className="space-y-2">
        <WizardRichTextField
          label="Описание услуги"
          required
          helperText="Что входит в услугу, как проходит процесс и что важно знать заранее."
          value={data.serviceDescription}
          onChange={(value) => onChange({ serviceDescription: value })}
          placeholder="Опишите что включает услуга, как проходит процесс..."
          disabled={!isEditable}
          minHeight={140}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="serviceDuration">Продолжительность</Label>
        <Input
          id="serviceDuration"
          placeholder="Например: 2 часа, весь день, по договоренности"
          value={data.serviceDuration}
          onChange={(e) => onChange({ serviceDuration: e.target.value })}
          disabled={!isEditable}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="serviceDeliveryArea">Зона обслуживания</Label>
        <Input
          id="serviceDeliveryArea"
          placeholder="Например: Минск и область, весь город"
          value={data.serviceDeliveryArea}
          onChange={(e) => onChange({ serviceDeliveryArea: e.target.value })}
          disabled={!isEditable}
        />
      </div>
    </div>
  );

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

      {isVisitProduct ? (
        <div className="rounded-2xl border border-border/70 bg-muted/30 p-4 text-sm text-muted-foreground">
          Для посещения места отдельные условия на этом шаге не обязательны.
          Основной сценарий и birthday-условия, если они нужны, заполняются на шаге
          размещения.
        </div>
      ) : null}

      {isPartyProduct ? (
        <div className="space-y-4">
          <div className="rounded-2xl border border-border/70 bg-muted/30 p-4 text-sm text-muted-foreground">
            Основные условия для праздника уже задаются на шаге со сценариями
            размещения. Здесь можно оставить дополнительные пояснения в общем
            описании и блоке цены.
          </div>
          {data.productType === "PARTY_PACKAGE"
            ? renderPartyFields()
            : renderServiceFields()}
        </div>
      ) : null}
    </div>
  );
}
