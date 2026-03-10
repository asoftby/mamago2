"use client";

import { useState, useEffect } from "react";
import { OpeningHoursEditor } from "@/components/openingHours";
import type { OpeningHoursData } from "@/components/openingHours";
import { createDefaultUIState, generateSummary } from "@/lib/openingHours";
import type { PlaceFormData } from "../types";

interface Step5OpeningHoursProps {
  data: PlaceFormData;
  onChange: (updates: Partial<PlaceFormData>) => void;
  isEditable?: boolean;
}

export function Step5OpeningHours({
  data,
  onChange,
  isEditable = true,
}: Step5OpeningHoursProps) {
  // Local state for editor
  const [localData, setLocalData] = useState<OpeningHoursData | null>(
    data.openingHoursData || createDefaultUIState()
  );

  // Sync with prop changes
  useEffect(() => {
    if (data.openingHoursData) {
      setLocalData(data.openingHoursData);
    }
  }, [data.openingHoursData]);

  const handleChange = (openingHoursData: OpeningHoursData) => {
    setLocalData(openingHoursData);
    onChange({ openingHoursData });
  };

  const summary = generateSummary(localData);

  return (
    <div className="space-y-6">
      {/* Info message */}
      <div className="text-sm text-muted-foreground bg-muted/50 p-4 rounded-lg">
        {!isEditable ? (
          <div className="text-amber-700 bg-amber-50 border border-amber-200 p-3 rounded">
            ⚠️ Место находится на модерации. Редактирование режима работы временно недоступно.
          </div>
        ) : (
          "Режим работы не обязателен. Вы можете заполнить его позже или пропустить этот шаг."
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
