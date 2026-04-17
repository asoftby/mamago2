"use client";

import { useState, useEffect } from "react";
import type { Place } from "../types";
import { WizardStepHeader } from "../components/WizardStepHeader";
import { OpeningHoursEditor } from "@/components/openingHours";
import type { OpeningHoursData } from "@/components/openingHours";
import { createDefaultUIState, generateSummary } from "@/lib/openingHours";

interface Step5OpeningHoursProps {
  place: Place;
  openingHoursData: OpeningHoursData | null;
  onUpdate: (data: OpeningHoursData | null) => void;
  onPrev: () => void;
  onNext: () => void;
  canNext?: boolean;
  isEditable?: boolean;
}

export function Step5OpeningHours({
  place,
  openingHoursData,
  onUpdate,
  onPrev,
  onNext,
  canNext = true,
  isEditable = true,
}: Step5OpeningHoursProps) {
  // Local state for editor - initialize from prop
  const [localData, setLocalData] = useState<OpeningHoursData | null>(() =>
    openingHoursData || createDefaultUIState()
  );

  const handleChange = (data: OpeningHoursData) => {
    setLocalData(data);
    onUpdate(data);
  };

  const summary = generateSummary(localData);

  return (
    <div className="space-y-8">
      <WizardStepHeader
        title="Режим работы"
        subtitle="Укажите, когда место обычно открыто для посетителей"
        onBack={onPrev}
        onNext={onNext}
        canNext={canNext}
        currentStep={5}
        totalSteps={6}
      />

      {/* Info message */}
      <div className="text-sm text-muted-foreground bg-muted/50 p-4 rounded-lg">
        {!isEditable ? (
          <div className="text-amber-700 bg-amber-50 border border-amber-200 p-3 rounded">
            ⚠️ Место находится на модерации. Редактирование режима работы временно недоступно.
          </div>
        ) : (
          "Режим работы не обязателен для сохранения черновика. Вы можете заполнить его позже."
        )}
      </div>

      {/* Editor */}
      <div className="bg-card border rounded-lg p-6">
        <OpeningHoursEditor
          value={localData}
          onChange={handleChange}
          timezone="Europe/Minsk"
          disabled={!isEditable}
        />
      </div>

      {/* Summary preview */}
      {localData && localData.mode === "WEEKLY" && (
        <div className="bg-muted/30 border rounded-lg p-4">
          <h3 className="text-sm font-medium mb-2">Краткое расписание:</h3>
          <pre className="text-sm text-muted-foreground whitespace-pre-wrap font-sans">
            {summary}
          </pre>
        </div>
      )}
    </div>
  );
}
