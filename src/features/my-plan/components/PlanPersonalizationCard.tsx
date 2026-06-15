"use client";

import { useCallback, useMemo, useState } from "react";
import { useFamilyPersona } from "@/contexts/FamilyPersonaContext";
import { useMiniAdultOnboardingSignals } from "@/features/my-plan/hooks/useMiniAdultOnboardingSignals";
import {
  MINI_ONBOARDING_DISMISS_SESSION_PREFIX,
  hasAdultSelectionPreferences,
  mergeSignalCatalog,
  resolveSelectedPlanPersonalization,
} from "@/features/my-plan/lib/miniAdultOnboardingConfig";
import {
  PlanPersonalizationBodyText,
  PlanPersonalizationCardShell,
  PlanPersonalizationTextAction,
} from "./PlanPersonalizationCardShell";
import { PlanPersonalizationEditor } from "./PlanPersonalizationEditor";
import { PlanPersonalizationSummary } from "./PlanPersonalizationSummary";

type AudienceExplanationMode = "free" | "adult" | "child" | "family";

type PlanPersona = {
  id: string;
  displayName: string;
  kind: "adult" | "child";
  birthDate?: string | null;
  preferenceSignalIds?: string[];
  leisureFormatSignalId?: string | null;
};

const audienceModeMeta: Record<
  AudienceExplanationMode,
  { title: string; description: string }
> = {
  free: {
    title: "Свободный поиск",
    description:
      "Ищите без ограничений — покажем все интересные варианты, а вы выберете то, что подходит именно сейчас.",
  },
  adult: {
    title: "Подбор для вас",
    description:
      "Учитываем ваши интересы и предпочтения. В приоритете — события, которые могут быть интересны именно вам.",
  },
  child: {
    title: "Подбор для ребёнка",
    description:
      "Сначала показываем события, которые лучше всего подходят ребёнку — по возрасту, интересам и формату.",
  },
  family: {
    title: "Семейный подбор",
    description:
      "В приоритете — интересы ребёнка, но мы также учитываем ваши предпочтения, чтобы подобрать комфортный вариант для всей семьи.",
  },
};

function readDismissedFromSession(userId: string | null): boolean {
  if (typeof window === "undefined" || !userId) return false;
  try {
    return sessionStorage.getItem(`${MINI_ONBOARDING_DISMISS_SESSION_PREFIX}${userId}`) === "1";
  } catch {
    return false;
  }
}

function writeDismissedToSession(userId: string | null, dismissed: boolean) {
  if (typeof window === "undefined" || !userId) return;
  try {
    const key = `${MINI_ONBOARDING_DISMISS_SESSION_PREFIX}${userId}`;
    if (dismissed) {
      sessionStorage.setItem(key, "1");
    } else {
      sessionStorage.removeItem(key);
    }
  } catch {
    // ignore
  }
}

type AdultPanelMode = "edit" | "summary" | "neutral";

export function PlanPersonalizationCard({
  mode,
  personas,
  selectedPersonaIds,
  compact = false,
}: {
  mode: AudienceExplanationMode;
  personas: PlanPersona[];
  selectedPersonaIds: string[];
  compact?: boolean;
}) {
  const family = useFamilyPersona();

  const adultPersona = useMemo(
    () => personas.find((persona) => persona.kind === "adult") ?? null,
    [personas],
  );

  const resolveIds = useMemo(() => {
    if (!adultPersona) return [];
    return [
      ...(adultPersona.preferenceSignalIds ?? []),
      ...(adultPersona.leisureFormatSignalId ? [adultPersona.leisureFormatSignalId] : []),
    ];
  }, [adultPersona]);

  const {
    preferenceSignals,
    formatSignals,
    resolvedSignals,
    allKnownSignals,
    loading: signalsLoading,
    usingFallback,
  } = useMiniAdultOnboardingSignals(resolveIds);

  const selectedChild = useMemo(() => {
    const selectedChildren = personas.filter(
      (persona) =>
        persona.kind === "child" && selectedPersonaIds.includes(persona.id),
    );
    if (selectedChildren.length === 1) return selectedChildren[0] ?? null;
    return null;
  }, [personas, selectedPersonaIds]);

  const onlyAdultSelected =
    mode === "adult" &&
    selectedPersonaIds.length === 1 &&
    !!adultPersona &&
    selectedPersonaIds.includes(adultPersona.id);

  const [isEditing, setIsEditing] = useState(false);
  const [sessionDismissed, setSessionDismissed] = useState(() =>
    readDismissedFromSession(adultPersona?.id ?? null),
  );

  const adultHasPreferences = adultPersona
    ? hasAdultSelectionPreferences(adultPersona)
    : false;

  const adultPanelMode = useMemo((): AdultPanelMode | null => {
    if (!onlyAdultSelected) return null;
    if (isEditing) return "edit";
    if (adultHasPreferences) return "summary";
    if (sessionDismissed) return "neutral";
    return "edit";
  }, [adultHasPreferences, isEditing, onlyAdultSelected, sessionDismissed]);

  const signalCatalog = useMemo(
    () => mergeSignalCatalog([...preferenceSignals, ...formatSignals], resolvedSignals),
    [formatSignals, preferenceSignals, resolvedSignals],
  );

  const { selectedPreferences, selectedFormat } = useMemo(
    () =>
      adultPersona
        ? resolveSelectedPlanPersonalization({
            preferenceSignalIds: adultPersona.preferenceSignalIds ?? [],
            leisureFormatSignalId: adultPersona.leisureFormatSignalId ?? null,
            catalog: signalCatalog.length > 0 ? signalCatalog : allKnownSignals,
          })
        : { selectedPreferences: [], selectedFormat: null },
    [adultPersona, allKnownSignals, signalCatalog],
  );

  const handleSaved = useCallback(async () => {
    writeDismissedToSession(adultPersona?.id ?? null, false);
    setSessionDismissed(false);
    setIsEditing(false);
    await family?.refresh();
  }, [adultPersona?.id, family]);

  const handleDismiss = useCallback(() => {
    writeDismissedToSession(adultPersona?.id ?? null, true);
    setSessionDismissed(true);
    setIsEditing(false);
  }, [adultPersona?.id]);

  if (onlyAdultSelected) {
    if (
      signalsLoading &&
      adultPanelMode === "edit" &&
      !adultHasPreferences &&
      !sessionDismissed
    ) {
      return (
        <PlanPersonalizationCardShell title="Подбор для вас" compact={compact}>
          <div className="mt-1 h-16 animate-pulse rounded-lg bg-neutral-100" />
        </PlanPersonalizationCardShell>
      );
    }

    if (adultPanelMode === "edit") {
      return (
        <PlanPersonalizationCardShell title="Подбор для вас" compact={compact}>
          <PlanPersonalizationEditor
            key={`edit-${(adultPersona?.preferenceSignalIds ?? []).join(",")}-${adultPersona?.leisureFormatSignalId ?? ""}-${isEditing}`}
            compact={compact}
            preferenceSignals={preferenceSignals}
            formatSignals={formatSignals}
            usingFallback={usingFallback}
            initialPreferenceIds={adultPersona?.preferenceSignalIds ?? []}
            initialFormatId={adultPersona?.leisureFormatSignalId ?? null}
            onSaved={handleSaved}
            onDismiss={handleDismiss}
          />
        </PlanPersonalizationCardShell>
      );
    }

    if (adultPanelMode === "summary") {
      return (
        <PlanPersonalizationCardShell title="Подбор для вас" compact={compact}>
          <PlanPersonalizationSummary
            compact={compact}
            selectedPreferences={selectedPreferences}
            selectedFormat={selectedFormat}
            onEdit={() => setIsEditing(true)}
          />
        </PlanPersonalizationCardShell>
      );
    }

    if (adultPanelMode === "neutral") {
      return (
        <PlanPersonalizationCardShell title="Подбор для вас" compact={compact}>
          <div className="space-y-2 pt-0.5">
            <PlanPersonalizationBodyText compact={compact}>
              Пока показываем универсальные идеи. Можно уточнить предпочтения позже.
            </PlanPersonalizationBodyText>
            <PlanPersonalizationTextAction
              label="Настроить"
              onClick={() => setIsEditing(true)}
            />
          </div>
        </PlanPersonalizationCardShell>
      );
    }
  }

  if (mode === "child" && selectedChild && !selectedChild.birthDate) {
    return (
      <PlanPersonalizationCardShell title="Подбор для ребёнка" compact={compact}>
        <PlanPersonalizationBodyText compact={compact}>
          Добавьте возраст ребёнка — так подбор станет точнее.
        </PlanPersonalizationBodyText>
      </PlanPersonalizationCardShell>
    );
  }

  const meta = audienceModeMeta[mode];
  return (
    <PlanPersonalizationCardShell title={meta.title} compact={compact}>
      <PlanPersonalizationBodyText compact={compact}>{meta.description}</PlanPersonalizationBodyText>
    </PlanPersonalizationCardShell>
  );
}
