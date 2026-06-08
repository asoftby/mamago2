"use client";

import type { PlanOnboardingSignalChip } from "@/lib/signals/signalUsageType";
import {
  PlanPersonalizationBodyText,
  PlanPersonalizationTextAction,
} from "./PlanPersonalizationCardShell";
import { SelectedSignalChips } from "./SelectedSignalChips";

type Props = {
  compact?: boolean;
  selectedPreferences: PlanOnboardingSignalChip[];
  selectedFormat: PlanOnboardingSignalChip | null;
  onEdit: () => void;
};

export function PlanPersonalizationSummary({
  compact,
  selectedPreferences,
  selectedFormat,
  onEdit,
}: Props) {
  return (
    <div className="space-y-2.5 pt-0.5">
      <PlanPersonalizationBodyText compact={compact}>
        Учитываем ваши интересы и предпочтения.
      </PlanPersonalizationBodyText>

      {selectedPreferences.length > 0 ? (
        <div className="space-y-1">
          <p className="text-[11px] font-medium uppercase tracking-wide text-[rgba(20,18,16,0.45)]">
            Предпочтения
          </p>
          <SelectedSignalChips signals={selectedPreferences} compact={compact} />
        </div>
      ) : null}

      {selectedFormat ? (
        <div className="space-y-1">
          <p className="text-[11px] font-medium uppercase tracking-wide text-[rgba(20,18,16,0.45)]">
            Формат
          </p>
          <SelectedSignalChips signals={[selectedFormat]} compact={compact} />
        </div>
      ) : null}

      <div className="pt-0.5">
        <PlanPersonalizationTextAction label="Изменить" onClick={onEdit} />
      </div>
    </div>
  );
}
