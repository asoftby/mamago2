// Step 3: Audience and Signals (MVP)
// Age range + signals selection

"use client";

import { AgeRangePicker } from "../components/AgeRangePicker";
import { SignalChipSelector } from "../components/SignalChipSelector";
import { SIGNAL_OPTIONS, type OfferFormDataMVP } from "../types.mvp";

interface Step3SignalsMVPProps {
  data: OfferFormDataMVP;
  onChange: (updates: Partial<OfferFormDataMVP>) => void;
  isEditable: boolean;
}

export function Step3SignalsMVP({
  data,
  onChange,
  isEditable,
}: Step3SignalsMVPProps) {
  const handleAgeChange = (min: number, max: number) => {
    onChange({
      ageMinMonths: min,
      ageMaxMonths: max,
    });
  };
  
  return (
    <div className="max-w-3xl mx-auto space-y-8 py-8">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-semibold mb-2">Для кого и как?</h2>
        <p className="text-muted-foreground">
          Укажите возраст и характеристики предложения
        </p>
      </div>
      
      {/* Age Range */}
      <div className="p-6 bg-white border border-gray-200 rounded-lg">
        <AgeRangePicker
          minMonths={data.ageMinMonths}
          maxMonths={data.ageMaxMonths}
          onChange={handleAgeChange}
          disabled={!isEditable}
        />
      </div>
      
      {/* Required Signals */}
      <div className="space-y-6">
        <div className="border-l-4 border-primary pl-4">
          <h3 className="font-semibold text-lg mb-1">Обязательные характеристики</h3>
          <p className="text-sm text-muted-foreground">
            Эти параметры помогут пользователям найти ваше предложение
          </p>
        </div>
        
        {/* Activity Signals */}
        <div className="p-6 bg-white border border-gray-200 rounded-lg">
          <SignalChipSelector
            label="Тип активности"
            description="Что будут делать дети? (выберите 1-3)"
            options={SIGNAL_OPTIONS.activity}
            value={data.activitySignals}
            onChange={(value) => onChange({ activitySignals: value })}
            min={1}
            max={3}
            required
            disabled={!isEditable}
          />
        </div>
        
        {/* Format Signals */}
        <div className="p-6 bg-white border border-gray-200 rounded-lg">
          <SignalChipSelector
            label="Формат проведения"
            description="Где проходит? (выберите 1-2)"
            options={SIGNAL_OPTIONS.format}
            value={data.formatSignals}
            onChange={(value) => onChange({ formatSignals: value })}
            min={1}
            max={2}
            required
            disabled={!isEditable}
          />
        </div>
        
        {/* Participation Signals */}
        <div className="p-6 bg-white border border-gray-200 rounded-lg">
          <SignalChipSelector
            label="Тип участия"
            description="Как участвуют дети? (выберите 1)"
            options={SIGNAL_OPTIONS.participation}
            value={data.participationSignals}
            onChange={(value) => onChange({ participationSignals: value })}
            min={1}
            max={1}
            required
            disabled={!isEditable}
          />
        </div>
      </div>
      
      {/* Optional Signals (Collapsed) */}
      <div className="space-y-6">
        <div className="border-l-4 border-gray-300 pl-4">
          <h3 className="font-semibold text-lg mb-1">Дополнительные характеристики</h3>
          <p className="text-sm text-muted-foreground">
            Необязательно, но помогает лучше описать предложение
          </p>
        </div>
        
        {/* Intention Signals */}
        <div className="p-6 bg-gray-50 border border-gray-200 rounded-lg">
          <SignalChipSelector
            label="Для какой цели?"
            description="Что ищут родители? (до 2)"
            options={SIGNAL_OPTIONS.intention}
            value={data.intentionSignals}
            onChange={(value) => onChange({ intentionSignals: value })}
            max={2}
            collapsed
            disabled={!isEditable}
          />
        </div>
        
        {/* Feature Signals */}
        <div className="p-6 bg-gray-50 border border-gray-200 rounded-lg">
          <SignalChipSelector
            label="Особенности"
            description="Важные детали (до 3)"
            options={SIGNAL_OPTIONS.features}
            value={data.featureSignals}
            onChange={(value) => onChange({ featureSignals: value })}
            max={3}
            collapsed
            disabled={!isEditable}
          />
        </div>
      </div>
      
      {/* Auto-suggestions hint */}
      {data.offerKind && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
          <div className="flex gap-2">
            <div className="text-green-600 mt-0.5">✨</div>
            <div className="text-sm text-green-900">
              <strong>Подсказка:</strong> Мы автоматически предзаполнили некоторые
              характеристики на основе типа предложения. Вы можете изменить их при
              необходимости.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
