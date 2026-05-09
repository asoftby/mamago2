// Step 5: Accommodation (CAMP type only)
// Describes accommodation, meals, transfer, and what to bring

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { OfferFormData } from "../types";

interface Step5AccommodationProps {
  data: OfferFormData;
  onChange: (updates: Partial<OfferFormData>) => void;
  isEditable: boolean;
}

export function Step5Accommodation({ data, onChange, isEditable }: Step5AccommodationProps) {
  const handleAccommodationProvidedChange = () => {
    onChange({ accommodationProvided: !data.accommodationProvided });
  };

  const handleAccommodationTypeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange({ accommodationType: e.target.value });
  };

  const handleAccommodationConditionsChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onChange({ accommodationConditions: e.target.value });
  };

  const handleMealInfoChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onChange({ mealInfo: e.target.value });
  };

  const handleTransferInfoChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onChange({ transferInfo: e.target.value });
  };

  const handleWhatToBringChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onChange({ whatToBring: e.target.value });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold mb-2">Размещение</h2>
        <p className="text-muted-foreground">
          Расскажите о бытовых условиях, питании и трансфере
        </p>
      </div>

      {/* Accommodation Provided */}
      <div className="space-y-3 bg-gray-50 border rounded-lg p-4">
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={data.accommodationProvided}
            onChange={handleAccommodationProvidedChange}
            disabled={!isEditable}
            className="w-4 h-4 rounded"
          />
          <span className="text-sm font-medium">Размещение предусмотрено</span>
        </label>
        <p className="text-xs text-muted-foreground ml-7">
          Отметьте, если лагерь предоставляет размещение
        </p>
      </div>

      {/* Accommodation Type */}
      {data.accommodationProvided && (
        <div className="space-y-2">
          <Label htmlFor="accommodationType">Тип размещения</Label>
          <Input
            id="accommodationType"
            placeholder="Например: палатки, коттеджи, гостиница, комнаты"
            value={data.accommodationType}
            onChange={handleAccommodationTypeChange}
            disabled={!isEditable}
          />
          <p className="text-xs text-muted-foreground">
            Опишите, где будут размещены участники
          </p>
        </div>
      )}

      {/* Accommodation Conditions */}
      {data.accommodationProvided && (
        <div className="space-y-2">
          <Label htmlFor="accommodationConditions">Условия проживания</Label>
          <Textarea
            id="accommodationConditions"
            placeholder="Опишите условия: количество человек в комнате, удобства, санузлы..."
            value={data.accommodationConditions}
            onChange={handleAccommodationConditionsChange}
            disabled={!isEditable}
            rows={3}
          />
          <p className="text-xs text-muted-foreground">
            Детали о комнатах, удобствах и санитарных условиях
          </p>
        </div>
      )}

      {/* Meal Info */}
      <div className="space-y-2">
        <Label htmlFor="mealInfo">Питание</Label>
        <Textarea
          id="mealInfo"
          placeholder="Например: 3-разовое питание, завтрак и обед, учитываются диеты..."
          value={data.mealInfo}
          onChange={handleMealInfoChange}
          disabled={!isEditable}
          rows={3}
        />
        <p className="text-xs text-muted-foreground">
          Опишите систему питания и возможность учёта диет
        </p>
      </div>

      {/* Transfer Info */}
      <div className="space-y-2">
        <Label htmlFor="transferInfo">Трансфер</Label>
        <Textarea
          id="transferInfo"
          placeholder="Например: трансфер из аэропорта, встреча на вокзале, самостоятельный приезд..."
          value={data.transferInfo}
          onChange={handleTransferInfoChange}
          disabled={!isEditable}
          rows={3}
        />
        <p className="text-xs text-muted-foreground">
          Информация о доставке участников до лагеря
        </p>
      </div>

      {/* What to Bring */}
      <div className="space-y-2">
        <Label htmlFor="whatToBring">Что взять с собой</Label>
        <Textarea
          id="whatToBring"
          placeholder="Например: удобную одежду, спортивную обувь, средства личной гигиены, документы..."
          value={data.whatToBring}
          onChange={handleWhatToBringChange}
          disabled={!isEditable}
          rows={3}
        />
        <p className="text-xs text-muted-foreground">
          Список необходимых вещей для участников
        </p>
      </div>

      {/* Info Box */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h4 className="font-medium text-blue-900 mb-2">Совет</h4>
        <p className="text-sm text-blue-700">
          Чем подробнее вы опишете условия размещения, питания и трансфера, тем больше родителей будут уверены в качестве лагеря.
        </p>
      </div>
    </div>
  );
}
