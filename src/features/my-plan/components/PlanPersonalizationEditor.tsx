"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { ChipsRow, type ChipItem } from "@/components/ui/chips-row";
import { cn } from "@/lib/utils";
import { toast } from "@/lib/toast";
import { notifyFamilyPersonasChanged } from "@/lib/family/familyPersonaEvents";
import type { PlanOnboardingSignalChip } from "@/lib/signals/signalUsageType";
import {
  MAX_MINI_ONBOARDING_PREFERENCES,
  isFallbackSignalId,
  sanitizeLeisureFormatSignalId,
  sanitizePreferenceSignalIds,
} from "@/features/my-plan/lib/miniAdultOnboardingConfig";
import { PlanPersonalizationBodyText } from "./PlanPersonalizationCardShell";

const PREFERENCE_LIMIT_HINT = "Можно выбрать до 3 предпочтений";

type Props = {
  preferenceSignals: PlanOnboardingSignalChip[];
  formatSignals: PlanOnboardingSignalChip[];
  initialPreferenceIds: string[];
  initialFormatId: string | null;
  usingFallback?: boolean;
  onSaved: () => void | Promise<void>;
  onDismiss: () => void;
  compact?: boolean;
};

export function PlanPersonalizationEditor({
  preferenceSignals,
  formatSignals,
  initialPreferenceIds,
  initialFormatId,
  usingFallback = false,
  onSaved,
  onDismiss,
  compact = false,
}: Props) {
  const [selectedPreferenceSignalIds, setSelectedPreferenceSignalIds] = useState(() =>
    sanitizePreferenceSignalIds(initialPreferenceIds, preferenceSignals, formatSignals),
  );
  const [selectedLeisureFormatSignalId, setSelectedLeisureFormatSignalId] = useState<
    string | null
  >(() => sanitizeLeisureFormatSignalId(initialFormatId, formatSignals));
  const [saving, setSaving] = useState(false);
  const [showPreferenceLimitHint, setShowPreferenceLimitHint] = useState(false);
  const limitHintTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (selectedPreferenceSignalIds.length < MAX_MINI_ONBOARDING_PREFERENCES) {
      setShowPreferenceLimitHint(false);
    }
  }, [selectedPreferenceSignalIds.length]);

  useEffect(
    () => () => {
      if (limitHintTimerRef.current != null) {
        window.clearTimeout(limitHintTimerRef.current);
      }
    },
    [],
  );

  const showLimitHint = useCallback(() => {
    setShowPreferenceLimitHint(true);
    if (limitHintTimerRef.current != null) {
      window.clearTimeout(limitHintTimerRef.current);
    }
    limitHintTimerRef.current = window.setTimeout(() => {
      setShowPreferenceLimitHint(false);
      limitHintTimerRef.current = null;
    }, 3500);
  }, []);

  const togglePreference = useCallback(
    (signalId: string) => {
      setSelectedPreferenceSignalIds((current) => {
        if (current.includes(signalId)) {
          return current.filter((value) => value !== signalId);
        }
        if (current.length >= MAX_MINI_ONBOARDING_PREFERENCES) {
          showLimitHint();
          return current;
        }
        return [...current, signalId];
      });
    },
    [showLimitHint],
  );

  const selectFormat = useCallback((signalId: string) => {
    setSelectedLeisureFormatSignalId((current) => (current === signalId ? null : signalId));
  }, []);

  const canApply =
    selectedPreferenceSignalIds.length >= 1 &&
    selectedPreferenceSignalIds.length <= MAX_MINI_ONBOARDING_PREFERENCES;

  const preferenceLimitReached =
    selectedPreferenceSignalIds.length >= MAX_MINI_ONBOARDING_PREFERENCES;

  const preferenceChipItems = useMemo<ChipItem[]>(
    () =>
      preferenceSignals.map((signal) => {
        const isSelected = selectedPreferenceSignalIds.includes(signal.id);
        const isDisabled = !isSelected && preferenceLimitReached;

        return {
          id: signal.id,
          label: signal.icon ? `${signal.icon} ${signal.title}` : signal.title,
          active: isSelected,
          disabled: isDisabled,
          onClick: () => togglePreference(signal.id),
          className: cn(
            isSelected
              ? "!border-[#EF8759] !bg-[#EF8759] !text-white shadow-sm"
              : isDisabled
                ? "!cursor-not-allowed !border-neutral-200 !bg-neutral-50 !text-neutral-400"
                : "!border-neutral-200 !bg-white !text-neutral-700 hover:!border-neutral-300",
          ),
        };
      }),
    [
      preferenceLimitReached,
      preferenceSignals,
      selectedPreferenceSignalIds,
      togglePreference,
    ],
  );

  const formatChipItems = useMemo<ChipItem[]>(
    () =>
      formatSignals.map((signal) => ({
        id: signal.id,
        label: signal.icon ? `${signal.icon} ${signal.title}` : signal.title,
        active: selectedLeisureFormatSignalId === signal.id,
        onClick: () => selectFormat(signal.id),
        className: cn(
          selectedLeisureFormatSignalId === signal.id
            ? "!border-[#EF8759] !bg-[#EF8759] !text-white shadow-sm"
            : "!border-neutral-200 !bg-white !text-neutral-700 hover:!border-neutral-300",
        ),
      })),
    [formatSignals, selectFormat, selectedLeisureFormatSignalId],
  );

  const handleApply = async () => {
    if (!canApply || saving) {
      return;
    }

    const preferenceSignalIds = sanitizePreferenceSignalIds(
      selectedPreferenceSignalIds,
      preferenceSignals,
      formatSignals,
    );
    const leisureFormatSignalId = sanitizeLeisureFormatSignalId(
      selectedLeisureFormatSignalId,
      formatSignals,
    );

    const usesFallbackSelection =
      usingFallback ||
      selectedPreferenceSignalIds.some(isFallbackSignalId) ||
      (selectedLeisureFormatSignalId != null &&
        isFallbackSignalId(selectedLeisureFormatSignalId));

    if (usesFallbackSelection || preferenceSignalIds.length === 0) {
      toast.error("Справочник предпочтений временно недоступен");
      return;
    }

    setSaving(true);
    try {
      const response = await fetch("/api/auth/me", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          preferenceSignalIds,
          leisureFormatSignalId,
        }),
      });
      if (!response.ok) {
        throw new Error("save_failed");
      }
      notifyFamilyPersonasChanged();
      await onSaved();
    } catch {
      toast.error("Не удалось сохранить предпочтения");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3 pt-0.5">
      <PlanPersonalizationBodyText compact={compact}>
        Выберите пару предпочтений — и мы покажем идеи, которые больше подходят именно вам.
      </PlanPersonalizationBodyText>

      {preferenceSignals.length > 0 ? (
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <p className="text-xs font-medium text-[rgba(20,18,16,0.72)]">Что вам ближе?</p>
            <span className="text-[11px] font-medium text-[rgba(20,18,16,0.45)]">
              {selectedPreferenceSignalIds.length}/{MAX_MINI_ONBOARDING_PREFERENCES}
            </span>
          </div>
          <ChipsRow layout="wrap" aria-label="Предпочтения" items={preferenceChipItems} />
          {showPreferenceLimitHint ? (
            <p className="text-[11px] leading-snug text-[#EF8759]">{PREFERENCE_LIMIT_HINT}</p>
          ) : null}
        </div>
      ) : null}

      {formatSignals.length > 0 ? (
        <div className="space-y-1.5">
          <div className="space-y-0.5">
            <p className="text-xs font-medium text-[rgba(20,18,16,0.72)]">Формат отдыха</p>
            <p className="text-[11px] text-[rgba(20,18,16,0.45)]">Необязательно</p>
          </div>
          <ChipsRow layout="wrap" aria-label="Формат отдыха" items={formatChipItems} />
        </div>
      ) : null}

      <div className="flex flex-col gap-2 sm:flex-row sm:items-stretch">
        <Button
          type="button"
          className={cn(
            "min-h-10 flex-1 rounded-full transition disabled:opacity-100",
            canApply && !saving
              ? "bg-[#EF8759] text-white hover:bg-[#e97848]"
              : "cursor-not-allowed bg-[#F5C3B0] text-white/80 hover:bg-[#F5C3B0]",
          )}
          disabled={!canApply || saving}
          onClick={() => void handleApply()}
        >
          {saving ? "Сохраняем…" : "Применить"}
        </Button>
        <Button
          type="button"
          variant="outline"
          className="min-h-10 flex-1 rounded-full border-neutral-200"
          disabled={saving}
          onClick={onDismiss}
        >
          Не сейчас
        </Button>
      </div>
    </div>
  );
}
