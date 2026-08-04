"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { RecommendationCard } from "./RecommendationCard";
import type { PlanItemWithActivity } from "../types/event";
import type { PlanSlotType } from "../hooks/useMyPlan";
import type { MyPlanIdea } from "../hooks/useMyPlan";
import { useOptionalCity } from "@/contexts/CityContext";
import { useFamilyPersona } from "@/contexts/FamilyPersonaContext";
import { getCityLocativePhrase } from "@/lib/city/cityDisplayNames";
import type { AgeRangeSelection } from "@/features/filters/discovery/childrenScope.store";
import { toast } from "@/lib/toast";
import { WeekCalendarStrip } from "./WeekCalendarStrip";
import { publicActivityPath } from "@/lib/business/eventPublicLink";
import { QuickAddChildModal } from "@/components/children/QuickAddChildModal";
import { QuickAddAdultModal } from "@/components/adults/QuickAddAdultModal";
import { DayScenarioModal } from "./DayScenarioModal";
import { AddPersonaTypeModal } from "./AddPersonaTypeModal";
import { AddParticipantModal } from "@/components/children/AddParticipantModal";
import { MyPlanHeader } from "./MyPlanHeader";
import { RecommendationDecisionBlock } from "./RecommendationDecisionBlock";
import { PlanNeedsAgeQuestion } from "./PlanNeedsAgeQuestion";
import { BuildScenarioButton } from "./BuildScenarioButton";
import { sortPlanItemsForDay } from "../lib/sortPlanItemsForDay";
import {
  MAX_PLAN_ITEMS_PER_SLOT,
  pickItemForSlotExcluding,
} from "../lib/recommendationPool";
import { useResolveDefaultParticipants } from "../lib/useResolveDefaultParticipants";
import { getAgeGroupByValue } from "@/features/filters/age/ageGroups";

interface PlanChildChip {
  id: string;
  name: string;
  birthDate?: string;
}

interface PlanMainContentProps {
  selectedDate: string;
  onChangeDate?: (date: string) => void;
  planItemsByDate?: Record<string, PlanItemWithActivity[]>;
  todayIso?: string;
  layout?: "default" | "desktop";
  onAddItemToPlan?: (item: PlanItemWithActivity) => void;
  /** Удалить пункт плана (сервер + локально). */
  onRemoveItemFromPlan?: (itemId: string) => void | Promise<boolean>;
  childrenList: PlanChildChip[];
  selectedChildIds: string[];
  onChangeSelectedChildIds: (
    childIds: string[],
    opts?: { adultIncluded?: boolean },
  ) => void;
  selectedAgeRanges: AgeRangeSelection[];
  onChangeSelectedAgeRanges: (ranges: AgeRangeSelection[]) => void;
  ideas?: MyPlanIdea[];
  ideasLoading?: boolean;
  onAddIdeaToPlan?: (idea: MyPlanIdea) => Promise<{ ok: boolean; slot?: PlanSlotType }>;
  onRemoveIdea?: (activityId: string) => Promise<boolean> | boolean;
  /** Подборка из каталога (не сохранённые идеи) */
  planSuggestions?: NonNullable<MyPlanIdea["activity"]>[];
  suggestionsLoading?: boolean;
  onAddSuggestionToPlan?: (
    activity: NonNullable<MyPlanIdea["activity"]>,
  ) => Promise<{ ok: boolean }>;
  /** Фоновая подгрузка выбранной даты (для smooth-перехода без резкого прыжка блока). */
  dateLoading?: boolean;
  onRequestClose?: () => void;
}

function addDaysIso(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, (m ?? 1) - 1, (d ?? 1) + days);
  const yy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const dd = String(dt.getDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

/**
 * Синтетический "ребёнок" только для клиентского демо-пула рекомендаций (recommendationPool.ts),
 * когда в профиле нет ни одного реального ребёнка — ответ на единственный вопрос слоя 0
 * (needs-age) не создаёт персону и не пишется в FamilyPersonaContext/профиль.
 */
function buildEphemeralAgeChild(ageGroupValue: string): {
  id: string;
  birthDate: string;
  systemInterests: string[];
} {
  const group = getAgeGroupByValue(ageGroupValue);
  const years = group?.min ?? 3;
  const birthDate = new Date();
  birthDate.setFullYear(birthDate.getFullYear() - years);
  return { id: `needs-age:${ageGroupValue}`, birthDate: birthDate.toISOString(), systemInterests: [] };
}

function toGenitiveName(name: string): string {
  const n = name.trim();
  if (!n) return name;
  const lower = n.toLowerCase();
  if (lower.endsWith("а")) {
    const base = n.slice(0, -1);
    const prev = base.slice(-1).toLowerCase();
    const ending = ["г", "к", "х", "ж", "ч", "ш", "щ"].includes(prev) ? "и" : "ы";
    return `${base}${ending}`;
  }
  if (lower.endsWith("я")) return `${n.slice(0, -1)}и`;
  if (lower.endsWith("й")) return `${n.slice(0, -1)}я`;
  if (lower.endsWith("ь")) return `${n.slice(0, -1)}я`;
  return `${n}а`;
}

type PersonaForCopy = {
  id: string;
  displayName: string;
  kind: "adult" | "child";
  isProfileComplete?: boolean;
};

/**
 * В текстах подборки («Для … в Минске», рекомендации) не показываем взрослого,
 * пока не заполнена анкета профиля в подборках (isProfileComplete).
 */
function selectedPersonasForAudienceCopy(
  selectedPersonaIds: string[],
  personas: PersonaForCopy[],
): PersonaForCopy[] {
  return personas.filter(
    (p) =>
      selectedPersonaIds.includes(p.id) &&
      (p.kind === "child" || p.isProfileComplete === true),
  );
}

/** Первая строка заголовка: дата без года — короче и стабильнее в шапке. */
function formatPlanHeaderTitle(selectedDate: string, todayKey: string): string {
  const d = new Date(selectedDate + "T12:00:00");
  const datePart = d.toLocaleDateString("ru-RU", { day: "numeric", month: "long" });
  const tomorrowKey = addDaysIso(todayKey, 1);
  if (selectedDate === todayKey) return `План на сегодня, ${datePart}`;
  if (selectedDate === tomorrowKey) return `План на завтра, ${datePart}`;
  return `План на ${weekdayForNa(d)}, ${datePart}`;
}

/** Вторая строка: «Для Алексея и Таи в Минске» (род. падеж + город в предложном); свободный поиск — «Свободный поиск в Минске». */
function buildPlanHeaderSubtitle(
  selectedPersonaIds: string[],
  personas: PersonaForCopy[],
  isFreeSearch: boolean,
  citySlug: string,
): string {
  const cityIn = getCityLocativePhrase(citySlug);
  if (isFreeSearch) {
    return `Свободный поиск ${cityIn}`;
  }
  const selected = selectedPersonasForAudienceCopy(selectedPersonaIds, personas);
  if (selected.length === 0) {
    return `Свободный поиск ${cityIn}`;
  }
  const namesGen = selected.map((p) => {
    if (p.kind === "adult") {
      const n = p.displayName?.trim();
      if (n && n !== "Я") return toGenitiveName(n);
      return "меня";
    }
    const dn = p.displayName?.trim();
    return dn ? toGenitiveName(dn) : "ребёнка";
  });
  let forWhom: string;
  if (namesGen.length === 1) forWhom = namesGen[0];
  else if (namesGen.length === 2) forWhom = `${namesGen[0]} и ${namesGen[1]}`;
  else if (namesGen.length === 3) {
    forWhom = `${namesGen[0]}, ${namesGen[1]} и ${namesGen[2]}`;
  } else {
    forWhom = `${namesGen[0]}, ${namesGen[1]} и ещё ${namesGen.length - 2}`;
  }
  return `Для ${forWhom} ${cityIn}`;
}

/** Заголовок блока «Рекомендации»: свободный поиск vs персонализированный список имён + дата. */
function buildRecommendationsSectionHeading(
  selectedPersonaIds: string[],
  personas: PersonaForCopy[],
  isFreeSearch: boolean,
  selectedDate: string,
  todayKey: string,
): string {
  const d = new Date(selectedDate + "T12:00:00");
  const dayMonth = d.toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long",
  });
  const headingNoAudience = (() => {
    if (selectedDate === todayKey) return `mamaGo рекомендации на сегодня, ${dayMonth}`;
    if (selectedDate === addDaysIso(todayKey, 1))
      return `mamaGo рекомендации на завтра, ${dayMonth}`;
    return `mamaGo рекомендации на ${dayMonth}`;
  })();

  if (isFreeSearch) return headingNoAudience;

  const selected = selectedPersonasForAudienceCopy(selectedPersonaIds, personas);
  if (selected.length === 0) return headingNoAudience;

  const namesGen = selected.map((p) => {
    if (p.kind === "adult") {
      const n = p.displayName?.trim();
      if (n && n !== "Я") return toGenitiveName(n);
      return "меня";
    }
    const dn = p.displayName?.trim();
    return dn ? toGenitiveName(dn) : "ребёнка";
  });

  let forWhom: string;
  if (namesGen.length === 1) forWhom = namesGen[0];
  else if (namesGen.length === 2) forWhom = `${namesGen[0]} и ${namesGen[1]}`;
  else if (namesGen.length === 3) {
    forWhom = `${namesGen[0]}, ${namesGen[1]} и ${namesGen[2]}`;
  } else {
    forWhom = `${namesGen[0]}, ${namesGen[1]} и ещё ${namesGen.length - 2}`;
  }

  let whenRu: string;
  if (selectedDate === todayKey) {
    whenRu = `на сегодня, ${dayMonth}`;
  } else if (selectedDate === addDaysIso(todayKey, 1)) {
    whenRu = `на завтра, ${dayMonth}`;
  } else {
    whenRu = `на ${dayMonth}`;
  }

  return `mamaGo рекомендации для ${forWhom} ${whenRu}`;
}

function joinNamesRu(names: string[]): string {
  if (names.length <= 1) return names[0] ?? "";
  if (names.length === 2) return `${names[0]} и ${names[1]}`;
  if (names.length === 3) return `${names[0]}, ${names[1]} и ${names[2]}`;
  return `${names[0]}, ${names[1]} и ${names[2]}`;
}

function buildAutoPlanCtaTitle(input: {
  selectedDate: string;
  todayKey: string;
  selectedPersonaIds: string[];
  personas: PersonaForCopy[];
}): string {
  const when = input.selectedDate === input.todayKey ? "сегодня" : "этот день";
  const selected = input.personas.filter((p) =>
    input.selectedPersonaIds.includes(p.id),
  );
  const names = selected
    .map((p) => p.displayName?.trim())
    .filter((v): v is string => Boolean(v));

  if (names.length === 0) return `Составить план на ${when}`;
  return `Составить план на ${when} для ${joinNamesRu(names.map(toGenitiveName))}`;
}

function buildAutoPlanHint(input: {
  selectedDate: string;
  todayKey: string;
  selectedPersonaIds: string[];
  personas: PersonaForCopy[];
  isFreeSearch: boolean;
}): string {
  if (input.isFreeSearch) return "Предлагаю варианты: утро, день, вечер.";

  const when = input.selectedDate === input.todayKey ? "сегодня" : "этот день";
  const selected = input.personas.filter((p) => input.selectedPersonaIds.includes(p.id));
  const names = selected
    .map((p) => p.displayName?.trim())
    .filter((v): v is string => Boolean(v));

  if (names.length === 0) return "Предлагаю варианты: утро, день, вечер.";
  return `На ${when} для ${joinNamesRu(names.map(toGenitiveName))} предлагаю варианты:`;
}

const RECOMMENDATIONS_BLOCK_SUBTITLE =
  "Подобрано на основании ваших интересов и предпочтений";

function formatRecommendationHeading(selectedDate: string, todayKey: string): string {
  const d = new Date(selectedDate + "T12:00:00");
  const dayMonth = d.toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long",
  });
  if (selectedDate === todayKey) return "Вот что я рекомендую на сегодня";
  if (selectedDate === addDaysIso(todayKey, 1)) return "Вот что я рекомендую на завтра";
  return `Вот что я рекомендую на ${dayMonth}`;
}

function buildParticipantSummaryLabels(
  selectedPersonaIds: string[],
  personas: PersonaForCopy[],
): string[] {
  const selected = personas.filter((persona) => selectedPersonaIds.includes(persona.id));
  if (selected.length === 0) {
    return [];
  }
  return selected.map((persona) =>
    persona.kind === "adult" ? "Я" : persona.displayName.trim() || "Ребёнок",
  );
}

function weekdayForNa(date: Date): string {
  const weekday = date.toLocaleDateString("ru-RU", { weekday: "long" }).toLowerCase();
  const accusativeByNa: Record<string, string> = {
    понедельник: "понедельник",
    вторник: "вторник",
    среда: "среду",
    четверг: "четверг",
    пятница: "пятницу",
    суббота: "субботу",
    воскресенье: "воскресенье",
  };
  return accusativeByNa[weekday] ?? weekday;
}

export function PlanMainContent({
  selectedDate,
  onChangeDate,
  planItemsByDate,
  todayIso,
  layout = "default",
  onAddItemToPlan,
  onRemoveItemFromPlan,
  childrenList,
  selectedChildIds,
  selectedAgeRanges,
  onChangeSelectedAgeRanges,
  ideas = [],
  ideasLoading = false,
  onAddIdeaToPlan,
  onRemoveIdea,
  planSuggestions = [],
  suggestionsLoading = false,
  onAddSuggestionToPlan,
  dateLoading = false,
  onRequestClose,
}: PlanMainContentProps) {
  const pathname = usePathname();
  const router = useRouter();
  const currentSearchParams = useSearchParams();
  const cityCtx = useOptionalCity();
  const city = cityCtx?.citySlug ?? "minsk";
  const family = useFamilyPersona();
  const isDesktop = layout === "desktop";
  const [removingIdeaActivityId, setRemovingIdeaActivityId] = useState<string | null>(null);
  const [addingActivityId, setAddingActivityId] = useState<string | null>(null);
  const [showAddChildModal, setShowAddChildModal] = useState(false);
  const [showAddAdultModal, setShowAddAdultModal] = useState(false);
  const [showAddPersonaTypeModal, setShowAddPersonaTypeModal] = useState(false);
  const [showAdultParticipantModal, setShowAdultParticipantModal] = useState(false);
  const [showAudienceSheet, setShowAudienceSheet] = useState(false);
  const [showDayScenario, setShowDayScenario] = useState(false);
  const [awaitingAgeAnswer, setAwaitingAgeAnswer] = useState(false);
  const [needsAgeAnswerValue, setNeedsAgeAnswerValue] = useState<string | null>(null);
  const [autoPlanDraft, setAutoPlanDraft] = useState<
    Array<{ slot: "morning" | "afternoon" | "evening"; item: PlanItemWithActivity }>
  >([]);
  const [autoPlanGeneration, setAutoPlanGeneration] = useState(0);
  const [autoPlanCursor, setAutoPlanCursor] = useState(0);
  const [autoPlanLocalAddedIds, setAutoPlanLocalAddedIds] = useState<string[]>([]);
  const [autoPlanLocalSlotAdds, setAutoPlanLocalSlotAdds] = useState<
    Record<"morning" | "afternoon" | "evening", number>
  >({
    morning: 0,
    afternoon: 0,
    evening: 0,
  });
  const [isAutoPlanGenerating, setIsAutoPlanGenerating] = useState(false);

  const handleRemoveFromPlan = async (itemId: string) => {
    if (!onRemoveItemFromPlan) return;
    try {
      const result = onRemoveItemFromPlan(itemId);
      const ok = result instanceof Promise ? await result : true;
      if (!ok) toast.error("Не получилось убрать событие из плана");
    } catch {
      toast.error("Не получилось убрать событие из плана");
    }
  };



  // Персоны для audience selector (must be declared before use)
  const personas = useMemo(() => {
    if (!family?.personas) return [];
    return family.personas;
  }, [family?.personas]);

  /**
   * Полный список выбранных персон (взрослые + дети) из FamilyPersonaContext
   */
  const selectedPersonaIds = useMemo(() => {
    if (!family?.selectedPersonaIds) return [];
    return family.selectedPersonaIds;
  }, [family?.selectedPersonaIds]);
  const effectiveSelectedChildIds = useMemo(() => {
    if (selectedPersonaIds.length > 0) {
      const selectedChildSet = new Set(
        personas
          .filter(
            (persona) =>
              persona.kind === "child" && selectedPersonaIds.includes(persona.id),
          )
          .map((persona) => persona.id),
      );
      return childrenList
        .map((child) => child.id)
        .filter((childId) => selectedChildSet.has(childId));
    }
    return selectedChildIds;
  }, [childrenList, personas, selectedChildIds, selectedPersonaIds]);

  /**
   * Audience mode: derived from FamilyPersonaContext via selectedPersonaIds
   * - "free": no personas selected (free search mode, no personalization)
   * - "specific": one or more personas selected (personalized recommendations)
   */
  const audienceMode = useMemo<"specific" | "free">(() => {
    return selectedPersonaIds.length > 0 ? "specific" : "free";
  }, [selectedPersonaIds.length]);

  /**
   * Toggle persona selection - syncs with FamilyPersonaContext automatically
   */
  const handleTogglePersona = useCallback((personaId: string) => {
    const current = family?.selectedPersonaIds ?? [];
    const isSelected = current.includes(personaId);
    const next = isSelected
      ? current.filter((id) => id !== personaId)
      : [...current, personaId];

    family?.setSelectedPersonaIds(next);

    if (next.length === 0) {
      onChangeSelectedAgeRanges([]);
    }
  }, [family, onChangeSelectedAgeRanges]);

  /**
   * Toggle free search mode - clears all persona selections
   */
  const handleToggleFreeMode = useCallback(() => {
    family?.setSelectedPersonaIds([]);
    onChangeSelectedAgeRanges([]);
  }, [family, onChangeSelectedAgeRanges]);

  /**
   * Label for selected audience - includes adult if selected
   */
  const selectedChildrenLabel = useMemo(() => {
    // Free search mode
    if (selectedPersonaIds.length === 0) return "Свободный поиск";
    
    const selectedPersonas = selectedPersonasForAudienceCopy(
      selectedPersonaIds,
      personas,
    );
    
    if (selectedPersonas.length === 0) return "Свободный поиск";
    
    // Build label with genitive case
    const names = selectedPersonas.map((p) => {
      if (p.kind === "adult") {
        return "меня"; // Genitive case for "Я"
      }
      return toGenitiveName(p.displayName);
    });
    
    if (names.length === 1) return `Для ${names[0]}`;
    if (names.length === 2) return `Для ${names[0]} и ${names[1]}`;
    return `Для ${names.slice(0, 2).join(", ")} и ещё ${names.length - 2}`;
  }, [
    selectedPersonaIds,
    personas,
  ]);

  const returnTo = useMemo(() => {
    const q = currentSearchParams.toString();
    return q ? `${pathname}?${q}` : pathname;
  }, [pathname, currentSearchParams]);

  const buildFindAndAddHref = () => {
    const qp = new URLSearchParams();
    qp.set("from", selectedDate);
    qp.set("to", selectedDate);
    qp.set("date", selectedDate);
    if (effectiveSelectedChildIds.length === 0 || effectiveSelectedChildIds.length === childrenList.length) {
      qp.set("children", "all");
    } else {
      qp.set("children", effectiveSelectedChildIds.join(","));
    }
    qp.set("planChildrenLabel", selectedChildrenLabel);
    qp.set("planMode", "1");
    qp.set("planDate", selectedDate);
    qp.set("returnTo", returnTo);
    const selectedAgeGroups = Array.from(new Set(selectedAgeRanges.map((x) => x.range)));
    if (selectedAgeGroups.length > 0) {
      qp.set("age", selectedAgeGroups.join(","));
    }
    return `/${city}/events?${qp.toString()}`;
  };

  const buildIdeasHref = () => {
    return `/my-ideas`;
  };

  const handleFindAndAddClick = (event: React.MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    const href = buildFindAndAddHref();
    onRequestClose?.();
    // Даем Dialog/Sheet закрыться до навигации, чтобы не оставался overlay.
    window.setTimeout(() => {
      router.push(href);
    }, 0);
  };

  const handleOpenCatalog = useCallback(() => {
    const href = buildFindAndAddHref();
    onRequestClose?.();
    window.setTimeout(() => {
      router.push(href);
    }, 0);
  }, [buildFindAndAddHref, onRequestClose, router]);

  const handleOpenIdeasFlow = useCallback(() => {
    const href = buildIdeasHref();
    onRequestClose?.();
    window.setTimeout(() => {
      router.push(href);
    }, 0);
  }, [buildIdeasHref, onRequestClose, router]);

  const dayItems = useMemo(() => planItemsByDate?.[selectedDate] ?? [], [planItemsByDate, selectedDate]);
  const plannedCountByDate = useMemo(() => {
    const result: Record<string, number> = {};

    for (const [date, items] of Object.entries(planItemsByDate ?? {})) {
      result[date] = items.length;
    }

    return result;
  }, [planItemsByDate]);

  const slotFromStartsAt = useCallback(
    (
      startsAt: Date | string | null | undefined,
    ): "morning" | "afternoon" | "evening" | null => {
      if (!startsAt) return null;
      const d = startsAt instanceof Date ? startsAt : new Date(startsAt);
      if (Number.isNaN(d.getTime())) return null;
      const h = d.getHours();
      if (h < 12) return "morning";
      if (h < 18) return "afternoon";
      return "evening";
    },
    [],
  );

  const daySlotCounts = useMemo(() => {
    const counts: Record<"morning" | "afternoon" | "evening", number> = {
      morning: 0,
      afternoon: 0,
      evening: 0,
    };
    for (const item of dayItems) {
      const slot = slotFromStartsAt(item.startsAt);
      if (slot) counts[slot] += 1;
    }
    return {
      morning: counts.morning + autoPlanLocalSlotAdds.morning,
      afternoon: counts.afternoon + autoPlanLocalSlotAdds.afternoon,
      evening: counts.evening + autoPlanLocalSlotAdds.evening,
    };
  }, [dayItems, slotFromStartsAt, autoPlanLocalSlotAdds]);

  const handleBuildAutoPlan = useCallback(
    (options?: { ephemeralAgeGroupValue?: string | null; explicitChildIds?: string[] }) => {
      const allSlots: Array<"morning" | "afternoon" | "evening"> = [
        "morning",
        "afternoon",
        "evening",
      ];
      const slots = allSlots.filter((slot) => daySlotCounts[slot] < MAX_PLAN_ITEMS_PER_SLOT);
      const resolvedChildIds = options?.explicitChildIds ?? effectiveSelectedChildIds;
      const selectedChildren = childrenList
        .filter((c) => resolvedChildIds.includes(c.id))
        .map((c) => ({
          id: c.id,
          birthDate: c.birthDate ?? new Date().toISOString(),
          systemInterests: [] as string[],
        }));
      const recChildren =
        selectedChildren.length > 0
          ? selectedChildren
          : childrenList.length > 0
            ? childrenList.map((c) => ({
                id: c.id,
                birthDate: c.birthDate ?? new Date().toISOString(),
                systemInterests: [] as string[],
              }))
            : options?.ephemeralAgeGroupValue
              ? [buildEphemeralAgeChild(options.ephemeralAgeGroupValue)]
              : [];

      const exclude = new Set([
        ...(planItemsByDate?.[selectedDate] ?? [])
          .map((i) => i.activityId)
          .filter((v): v is string => Boolean(v)),
        ...autoPlanLocalAddedIds,
      ]);

      const draft = slots.map((slot) => {
        const item = pickItemForSlotExcluding(
          slot,
          recChildren,
          "all",
          autoPlanCursor,
          selectedDate,
          [...exclude],
        );
        if (item.activityId) exclude.add(item.activityId);
        return { slot, item };
      });

      setAutoPlanDraft(draft);
      setAutoPlanGeneration((v) => v + 1);
      setAutoPlanCursor((v) => v + 1);
    },
    [
      autoPlanCursor,
      autoPlanLocalAddedIds,
      childrenList,
      daySlotCounts,
      effectiveSelectedChildIds,
      planItemsByDate,
      selectedDate,
    ],
  );

  const handleDecideRecommendations = useCallback(
    (options?: { ephemeralAgeGroupValue?: string | null; explicitChildIds?: string[] }) => {
      setIsAutoPlanGenerating(true);
      handleBuildAutoPlan(options);
      window.setTimeout(() => {
        document
          .getElementById("plan-recommendation-results")
          ?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 120);
      window.setTimeout(() => {
        setIsAutoPlanGenerating(false);
      }, 1300);
    },
    [handleBuildAutoPlan],
  );

  const defaultParticipants = useResolveDefaultParticipants();

  /**
   * Слой 0: «Реши за меня» — намерение сначала, состав правится после выдачи (M3).
   * Резолвленный состав передаётся генератору напрямую, а не через
   * `family.setSelectedPersonaIds` — тот же клик иначе попадал под effect (ниже),
   * который сбрасывает уже сгенерированный autoPlanDraft при смене selectedPersonaIds.
   */
  const handleDecideClick = useCallback(() => {
    if (defaultParticipants.source === "needs-age") {
      if (needsAgeAnswerValue) {
        handleDecideRecommendations({ ephemeralAgeGroupValue: needsAgeAnswerValue });
        return;
      }
      setAwaitingAgeAnswer(true);
      return;
    }
    const explicitChildIds = personas
      .filter((p) => p.kind === "child" && defaultParticipants.participants.includes(p.id))
      .map((p) => p.id);
    handleDecideRecommendations({ explicitChildIds });
  }, [defaultParticipants, needsAgeAnswerValue, personas, handleDecideRecommendations]);

  const handleAgeAnswerSelect = useCallback(
    (value: string) => {
      setNeedsAgeAnswerValue(value);
      setAwaitingAgeAnswer(false);
      onChangeSelectedAgeRanges([{ range: value, source: "manual" }]);
      handleDecideRecommendations({ ephemeralAgeGroupValue: value });
    },
    [onChangeSelectedAgeRanges, handleDecideRecommendations],
  );

  const handleAgeAnswerCancel = useCallback(() => {
    setAwaitingAgeAnswer(false);
  }, []);

  const handleRemoveIdea = async (activityId: string) => {
    if (!onRemoveIdea) return;
    setRemovingIdeaActivityId(activityId);
    try {
      await onRemoveIdea(activityId);
    } finally {
      setRemovingIdeaActivityId(null);
    }
  };

  const handleIdeaOpenClick = (
    event: React.MouseEvent<HTMLAnchorElement>,
    activity: { id: string; slug?: string | null },
  ) => {
    event.preventDefault();
    const href = publicActivityPath(activity.id, city, activity.slug);
    onRequestClose?.();
    window.setTimeout(() => {
      router.push(href);
    }, 0);
  };
  const handleIdeasPageClick = (event: React.MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    onRequestClose?.();
    window.setTimeout(() => {
      router.push("/ideas");
    }, 0);
  };

  const handleAddIdeaToPlan = useCallback(
    async (idea: MyPlanIdea) => {
      if (!onAddIdeaToPlan) return;
      if (
        (planItemsByDate?.[selectedDate] ?? []).some(
          (i) => i.activityId === idea.activityId,
        )
      ) {
        return;
      }
      setAddingActivityId(idea.activityId);
      try {
        const result = await onAddIdeaToPlan(idea);
        if (!result.ok) {
          toast.error("Не получилось выполнить действие");
        } else {
          toast.success("Добавлено в план");
        }
      } catch {
        toast.error("Не получилось выполнить действие");
      } finally {
        setAddingActivityId(null);
      }
    },
    [onAddIdeaToPlan, planItemsByDate, selectedDate],
  );

  const handleAddSuggestionToPlan = useCallback(
    async (activity: NonNullable<MyPlanIdea["activity"]>) => {
      if (
        (planItemsByDate?.[selectedDate] ?? []).some(
          (i) => i.activityId === activity.id,
        )
      ) {
        return false;
      }
      if (!onAddSuggestionToPlan) return false;
      setAddingActivityId(activity.id);
      try {
        const result = await onAddSuggestionToPlan(activity);
        if (!result.ok) {
          toast.error("Не получилось выполнить действие");
          return false;
        } else {
          requestAnimationFrame(() => {
            document.getElementById("my-plan-recommendations")?.scrollTo({
              top: 0,
              behavior: "smooth",
            });
          });
          return true;
        }
      } catch {
        toast.error("Не получилось выполнить действие");
        return false;
      } finally {
        setAddingActivityId(null);
      }
    },
    [onAddSuggestionToPlan, selectedDate, planItemsByDate],
  );

  const isFreeSearchMode = useMemo(() => {
    if (selectedPersonaIds.length === 0) return true;
    return personas.filter((p) => selectedPersonaIds.includes(p.id)).length === 0;
  }, [selectedPersonaIds, personas]);

  const hasDateSnapshot = useMemo(
    () => Object.prototype.hasOwnProperty.call(planItemsByDate ?? {}, selectedDate),
    [planItemsByDate, selectedDate],
  );
  const isPendingDateHydration = dateLoading && !hasDateSnapshot;

  const inPlanActivityIds = useMemo(() => {
    const ids = new Set<string>();
    for (const item of dayItems) {
      if (item.activityId) ids.add(item.activityId);
    }
    return ids;
  }, [dayItems]);

  const dayItemsSorted = useMemo(
    () => sortPlanItemsForDay(dayItems),
    [dayItems],
  );

  const totalPlannedCount = useMemo(() => {
    const existingActivityIds = new Set(
      dayItems.map((item) => item.activityId).filter((value): value is string => Boolean(value)),
    );
    const pendingLocalAdds = autoPlanLocalAddedIds.filter((id) => !existingActivityIds.has(id)).length;
    return dayItems.length + pendingLocalAdds;
  }, [dayItems, autoPlanLocalAddedIds]);

  /** «Сценарий дня» — когда в дне больше двух событий (три и более). */
  const canOpenDayScenario = useMemo(() => {
    return totalPlannedCount > 2;
  }, [totalPlannedCount]);

  const todayKey = todayIso ?? new Date().toISOString().split("T")[0];
  const slotLabel: Record<"morning" | "afternoon" | "evening", string> = {
    morning: "Утро",
    afternoon: "День",
    evening: "Вечер",
  };

  useEffect(() => {
    setAutoPlanDraft([]);
    setAutoPlanGeneration(0);
    setAutoPlanCursor(0);
    setAutoPlanLocalAddedIds([]);
    setAutoPlanLocalSlotAdds({ morning: 0, afternoon: 0, evening: 0 });
  }, [selectedDate, selectedPersonaIds]);

  const participantLabels = useMemo(
    () => buildParticipantSummaryLabels(selectedPersonaIds, personas),
    [selectedPersonaIds, personas],
  );

  const recommendationHeading = useMemo(
    () => formatRecommendationHeading(selectedDate, todayKey),
    [selectedDate, todayKey],
  );

  const recommendationAudienceLine =
    participantLabels.length > 0 ? participantLabels.join(" + ") : "Свободный поиск";

  const dayPartSections = useMemo(() => {
    const sections: Record<
      "morning" | "afternoon" | "evening",
      Array<
        | { kind: "planned"; item: PlanItemWithActivity }
        | { kind: "recommended"; item: PlanItemWithActivity }
      >
    > = {
      morning: [],
      afternoon: [],
      evening: [],
    };

    for (const item of dayItemsSorted) {
      const slot = slotFromStartsAt(item.startsAt) ?? "afternoon";
      sections[slot].push({ kind: "planned", item });
    }

    for (const draft of autoPlanDraft) {
      sections[draft.slot].push({ kind: "recommended", item: draft.item });
    }

    return (["morning", "afternoon", "evening"] as const)
      .map((slot) => ({
        slot,
        label: slotLabel[slot],
        entries: sections[slot],
      }))
      .filter((section) => section.entries.length > 0);
  }, [autoPlanDraft, dayItemsSorted, slotFromStartsAt]);

  const showRecommendationResults = dayPartSections.length > 0;

  const renderRecommendationArea = (compact: boolean) => {
    if (isPendingDateHydration) {
      return (
        <div className="animate-pulse rounded-[26px] border border-neutral-200 bg-white p-4 shadow-sm">
          <div className="h-4 w-44 rounded bg-neutral-200" />
          <div className="mt-3 h-3 w-52 rounded bg-neutral-100" />
          <div className="mt-4 h-24 rounded-[22px] bg-neutral-100/80" />
        </div>
      );
    }

    if (!showRecommendationResults) {
      return null;
    }

    const recommendationCards = dayPartSections.flatMap((section) =>
      section.entries.map((entry) => ({
        ...entry,
        slot: section.slot,
      })),
    );

    return (
      <div id="plan-recommendation-results" className="space-y-4">
        <section
          className={compact ? "space-y-3 px-1" : "space-y-3 px-1"}
          aria-label="Подходит вашим детям"
        >
          <div>
            <h3 style={{ fontFamily: "var(--font-sans)", fontSize: compact ? 18 : 22, fontWeight: 600, lineHeight: 1.1, color: "#141210" }}>
              Подходит вашим детям
            </h3>
            <p className="mt-1 text-sm text-neutral-500">Подобрано по возрасту и интересам</p>
          </div>
        </section>

        <section className={compact ? "space-y-3" : "space-y-3"}>
          {recommendationCards.map((entry) => (
              <RecommendationCard
                key={`${entry.slot}-${entry.kind}-${entry.item.id}`}
                item={entry.item}
                isInPlan={entry.kind === "planned"}
                onRemoveFromPlan={
                  entry.kind === "planned"
                    ? () => handleRemoveFromPlan(entry.item.id)
                    : undefined
                }
                onAddToPlan={
                  entry.kind === "recommended"
                    ? async () => {
                        if (!entry.item.activity) return;
                        const ok = await handleAddSuggestionToPlan(entry.item.activity);
                        if (!ok) return;
                        if (entry.item.activityId) {
                          setAutoPlanLocalAddedIds((prev) =>
                            prev.includes(entry.item.activityId!)
                              ? prev
                              : [...prev, entry.item.activityId!],
                          );
                        }
                        setAutoPlanLocalSlotAdds((prev) => ({
                          ...prev,
                          [entry.slot]: prev[entry.slot] + 1,
                        }));
                        setAutoPlanDraft((prev) =>
                          prev.filter((draft) => draft.item.id !== entry.item.id),
                        );
                      }
                    : undefined
                }
              />
            ))}
        </section>
      </div>
    );
  };

  const renderBottomActions = () => (
    <div className="space-y-3">
      {canOpenDayScenario ? (
        <BuildScenarioButton onClick={() => setShowDayScenario(true)} />
      ) : null}
    </div>
  );

  if (isDesktop) {
    return (
      <div className="flex h-full min-h-0 flex-col bg-white">
        <div className="sticky top-0 z-20 flex-shrink-0">
          <MyPlanHeader onClose={onRequestClose} />
        </div>

        <div
          id="my-plan-recommendations"
          className="min-h-0 flex-1 space-y-4 overflow-y-auto bg-white px-8 pb-6 pt-1"
        >
          {onChangeDate ? (
            <WeekCalendarStrip
              selectedDate={selectedDate}
              onChangeDate={onChangeDate}
              showArrows
              plannedCountByDate={plannedCountByDate}
            />
          ) : null}

          {awaitingAgeAnswer ? (
            <PlanNeedsAgeQuestion onSelect={handleAgeAnswerSelect} onCancel={handleAgeAnswerCancel} />
          ) : (
            <RecommendationDecisionBlock
              onDecide={handleDecideClick}
              onCatalog={handleOpenCatalog}
              onIdeas={handleOpenIdeasFlow}
              hasGenerated={autoPlanGeneration > 0}
              isGenerating={isAutoPlanGenerating}
            />
          )}

          {renderRecommendationArea(false)}

          {renderBottomActions()}
        </div>

        <AddPersonaTypeModal
          open={showAddPersonaTypeModal}
          onOpenChange={setShowAddPersonaTypeModal}
          onSelectChild={() => setShowAddChildModal(true)}
          onSelectAdult={() => setShowAddAdultModal(true)}
          layout="desktop"
        />

        <QuickAddChildModal
          open={showAddChildModal}
          onOpenChange={setShowAddChildModal}
          onSuccess={() => {
            toast.success("Ребёнок добавлен");
          }}
        />

        <QuickAddAdultModal
          open={showAddAdultModal}
          onOpenChange={setShowAddAdultModal}
          onSuccess={() => {
            toast.success("Взрослый добавлен");
          }}
        />

        <AddParticipantModal
          isOpen={showAdultParticipantModal}
          onClose={() => setShowAdultParticipantModal(false)}
          editAdult
          onSaved={() => {
            toast.success("Профиль обновлён");
          }}
        />

        <DayScenarioModal
          open={showDayScenario}
          onOpenChange={setShowDayScenario}
          date={selectedDate}
          city={city}
          participantLabels={participantLabels}
          items={dayItemsSorted}
          layout="desktop"
        />
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-white">
      <div className="flex-shrink-0">
        <MyPlanHeader onClose={onRequestClose} compact />
      </div>

      <div
        id="my-plan-recommendations"
        className="flex-1 space-y-4 overflow-y-auto bg-white px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-3"
      >
        {onChangeDate ? (
          <WeekCalendarStrip
            selectedDate={selectedDate}
            onChangeDate={onChangeDate}
            compact
            plannedCountByDate={plannedCountByDate}
          />
        ) : null}

        {awaitingAgeAnswer ? (
          <PlanNeedsAgeQuestion onSelect={handleAgeAnswerSelect} onCancel={handleAgeAnswerCancel} compact />
        ) : (
          <RecommendationDecisionBlock
            onDecide={handleDecideClick}
            onCatalog={handleOpenCatalog}
            onIdeas={handleOpenIdeasFlow}
            hasGenerated={autoPlanGeneration > 0}
            isGenerating={isAutoPlanGenerating}
            compact
          />
        )}

        {renderRecommendationArea(true)}

        {renderBottomActions()}
      </div>

      <AddPersonaTypeModal
        open={showAddPersonaTypeModal}
        onOpenChange={setShowAddPersonaTypeModal}
        onSelectChild={() => setShowAddChildModal(true)}
        onSelectAdult={() => setShowAddAdultModal(true)}
        layout="default"
      />

      <QuickAddChildModal
        open={showAddChildModal}
        onOpenChange={setShowAddChildModal}
        onSuccess={() => {
          toast.success("Ребёнок добавлен");
        }}
      />

      <QuickAddAdultModal
        open={showAddAdultModal}
        onOpenChange={setShowAddAdultModal}
        onSuccess={() => {
          toast.success("Взрослый добавлен");
        }}
      />

      <AddParticipantModal
        isOpen={showAdultParticipantModal}
        onClose={() => setShowAdultParticipantModal(false)}
        editAdult
        onSaved={() => {
          toast.success("Профиль обновлён");
        }}
      />

      <DayScenarioModal
        open={showDayScenario}
        onOpenChange={setShowDayScenario}
        date={selectedDate}
        city={city}
        participantLabels={participantLabels}
        items={dayItemsSorted}
        layout="default"
      />
    </div>
  );
}
