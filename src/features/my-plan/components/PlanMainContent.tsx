"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { RecommendationCard } from "./RecommendationCard";
import type { PlanItemWithActivity } from "../types/event";
import type { PlanSlotType } from "../hooks/useMyPlan";
import type { MyPlanIdea } from "../hooks/useMyPlan";
import { useOptionalCity } from "@/contexts/CityContext";
import { useFamilyPersona } from "@/contexts/FamilyPersonaContext";
import { getCityLocativePhrase } from "@/lib/city/cityDisplayNames";
import {
  deriveAgeRangesFromChildren,
  type AgeRangeSelection,
} from "@/features/filters/discovery/childrenScope.store";
import { toast } from "@/lib/toast";
import { WeekCalendarStrip } from "./WeekCalendarStrip";
import { UpcomingPlanBlock } from "./UpcomingPlanBlock";
import { selectUpcomingPlanItems } from "../lib/upcomingPlanItems";
import { publicActivityPath } from "@/lib/business/eventPublicLink";
import { QuickAddChildModal } from "@/components/children/QuickAddChildModal";
import { QuickAddAdultModal } from "@/components/adults/QuickAddAdultModal";
import { AddPersonaTypeModal } from "./AddPersonaTypeModal";
import { AddParticipantModal } from "@/components/children/AddParticipantModal";
import { MyPlanHeader } from "./MyPlanHeader";
import { RecommendationDecisionBlock } from "./RecommendationDecisionBlock";
import { PlanRecommendationCta } from "./PlanRecommendationCta";
import { PlanStickyCounter } from "./PlanStickyCounter";
import { MAX_SUGGESTION_BATCHES } from "../lib/suggestionsConfig";
import { PlanNeedsAgeQuestion } from "./PlanNeedsAgeQuestion";
import { BuildScenarioButton } from "./BuildScenarioButton";
import { resolveScenarioCtaState, resolveScenarioCtaLabel } from "../lib/canOpenDayScenario";
import { sortPlanItemsForDay } from "../lib/sortPlanItemsForDay";
import { useResolveDefaultParticipants } from "../lib/useResolveDefaultParticipants";
import { writeLastPlanAgeRanges } from "../lib/lastPlanAgeRangesStorage";
import {
  fetchPlanSuggestions,
  mapSuggestionToPlanItem,
  type PlanSuggestionItem,
} from "../lib/fetchPlanSuggestions";
import { getAgeGroupByValue } from "@/features/filters/age/ageGroups";
import {
  loadRecommendationDraft,
  persistRecommendationDraft,
  recommendationDraftKey,
  reconcileAddedActivityIds,
} from "../lib/planRecommendationDraftStorage";
import {
  focusPlanRecommendationResults,
  PLAN_RECOMMENDATION_RESULTS_A11Y,
} from "../lib/planRecommendationUi";

interface PlanChildChip {
  id: string;
  name: string;
  birthDate?: string;
}

interface PlanMainContentProps {
  selectedDate: string;
  onChangeDate?: (date: string) => void;
  planItemsByDate?: Record<string, PlanItemWithActivity[]>;
  scenarioStatusByDate?: Record<string, "ready" | "changed">;
  nearestPlanDate?: string | null;
  nearestPlanCount?: number;
  nearestPlanItems?: PlanItemWithActivity[];
  plannedCountByDate?: Record<string, number>;
  serverPlanSnapshotConfirmed?: boolean;
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

/**
 * Узкий пул — частый случай, не край (проверено замером: ~30% дат в горизонте месяца
 * дают 0 совпадений на dev-фикстуре). Сообщение объясняет причину предметно (дата,
 * при наличии — возраст), а не отделывается общим «ничего не нашли».
 */
function buildEmptySuggestionsMessage(
  selectedDate: string,
  todayKey: string,
  ageRangeValues: string[],
): string {
  const d = new Date(selectedDate + "T12:00:00");
  const dayMonth = d.toLocaleDateString("ru-RU", { day: "numeric", month: "long" });
  const whenPart =
    selectedDate === todayKey
      ? "На сегодня"
      : selectedDate === addDaysIso(todayKey, 1)
        ? "На завтра"
        : `На ${dayMonth}`;

  const ageLabels = ageRangeValues
    .map((v) => getAgeGroupByValue(v)?.label)
    .filter((label): label is string => Boolean(label));
  const agePart = ageLabels.length > 0 ? ` для ${ageLabels.join(", ")}` : "";

  return `${whenPart}${agePart} пока ничего не нашли.`;
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
  scenarioStatusByDate,
  nearestPlanDate = null,
  nearestPlanCount = 0,
  nearestPlanItems = [],
  plannedCountByDate = {},
  serverPlanSnapshotConfirmed = false,
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
  const [awaitingAgeAnswer, setAwaitingAgeAnswer] = useState(false);
  const [needsAgeAnswerValues, setNeedsAgeAnswerValues] = useState<string[] | null>(null);
  /** Реальные саджесты из /api/plan/suggestions (M2.4) — не клиентский demo-пул. */
  const [suggestions, setSuggestions] = useState<PlanSuggestionItem[]>([]);
  const [suggestionsGeneration, setSuggestionsGeneration] = useState(0);
  const [isFetchingSuggestions, setIsFetchingSuggestions] = useState(false);
  const [suggestionsError, setSuggestionsError] = useState(false);
  const [addedSuggestionActivityIds, setAddedSuggestionActivityIds] = useState<string[]>([]);
  const lastAgeRangeValuesRef = useRef<string[]>([]);
  /** Все id, когда-либо показанные в подборках этого сеанса — не даём «Ещё варианты» повторяться. */
  const shownSuggestionActivityIdsRef = useRef<Set<string>>(new Set());
  const hydratedDraftKeyRef = useRef<string | null>(null);
  const skipNextDraftPersistRef = useRef<string | null>(null);

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
  const recommendationDraftKeyValue = useMemo(
    () => recommendationDraftKey({ citySlug: city, date: selectedDate, audienceIds: selectedPersonaIds }),
    [city, selectedDate, selectedPersonaIds],
  );
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

  /** M-B: узкий пул — частый случай, пустая выдача сразу предлагает сменить дату. */
  const handleScrollToCalendar = useCallback(() => {
    document
      .getElementById("plan-week-calendar")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  /** M3.5: тап по sticky-счётчику «В плане: N» — на страницу плана целиком, не в саму модалку. */
  const handleOpenPlanPage = useCallback(() => {
    onRequestClose?.();
    window.setTimeout(() => {
      router.push("/me/plan");
    }, 0);
  }, [onRequestClose, router]);

  /** «Собрать сценарий дня» — переход на отдельную страницу, а не модалка поверх модалки. */
  const handleOpenScenarioPage = useCallback(() => {
    onRequestClose?.();
    window.setTimeout(() => {
      router.push(`/${city}/my-plan/${selectedDate}/scenario`);
    }, 0);
  }, [city, onRequestClose, router, selectedDate]);

  const dayItems = useMemo(() => planItemsByDate?.[selectedDate] ?? [], [planItemsByDate, selectedDate]);
  const upcomingSelection = useMemo(
    () => selectUpcomingPlanItems({
      selectedDate,
      todayIso: todayIso ?? new Date().toISOString().split("T")[0]!,
      selectedDateItems: dayItems,
      nearestDate: nearestPlanDate,
      nearestCount: nearestPlanCount,
      nearestItems: nearestPlanItems,
    }),
    [dayItems, nearestPlanCount, nearestPlanDate, nearestPlanItems, selectedDate, todayIso],
  );

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

  /**
   * Реальный fetch /api/plan/suggestions (M2.4) — параметры передаются явно вызывающим
   * кодом, не через реактивный стор, чтобы не зависеть от отстающего на кадр состояния
   * (тот же принцип, что уже применён для family.setSelectedPersonaIds в M2).
   * Исключает не только уже добавленные в план, но и всё, что уже показывалось в
   * этом сеансе (shownSuggestionActivityIdsRef) — «Ещё варианты» не повторяет офферы.
   */
  const handleFetchSuggestions = useCallback(
    async (ageRangeValues: string[]) => {
      lastAgeRangeValuesRef.current = ageRangeValues;
      setIsFetchingSuggestions(true);
      setSuggestionsError(false);
      try {
        const exclude = [
          ...(planItemsByDate?.[selectedDate] ?? [])
            .map((i) => i.activityId)
            .filter((v): v is string => Boolean(v)),
          ...addedSuggestionActivityIds,
          ...shownSuggestionActivityIdsRef.current,
        ];
        const results = await fetchPlanSuggestions({
          citySlug: city,
          date: selectedDate,
          excludeActivityIds: exclude,
          ageRangeValues,
        });
        for (const item of results) {
          shownSuggestionActivityIdsRef.current.add(item.id);
        }
        setSuggestions(results);
        setSuggestionsGeneration((v) => v + 1);
        window.setTimeout(() => {
          focusPlanRecommendationResults(document);
        }, 120);
      } catch {
        setSuggestionsError(true);
        setSuggestions([]);
      } finally {
        setIsFetchingSuggestions(false);
      }
    },
    [city, selectedDate, planItemsByDate, addedSuggestionActivityIds],
  );

  const defaultParticipants = useResolveDefaultParticipants();

  /**
   * Слой 0: «Реши за меня» — намерение сначала, состав правится после выдачи (M3).
   * Возраст для запроса выводится из резолвленного состава напрямую (не через
   * family.setSelectedPersonaIds) — синхронный вызов setSelectedPersonaIds из этого
   * клика попадал под effect ниже, который сбрасывает выдачу при смене selectedPersonaIds.
   */
  const handleDecideClick = useCallback(() => {
    if (defaultParticipants.source === "needs-age") {
      if (needsAgeAnswerValues && needsAgeAnswerValues.length > 0) {
        void handleFetchSuggestions(needsAgeAnswerValues);
        return;
      }
      setAwaitingAgeAnswer(true);
      return;
    }
    if (defaultParticipants.source === "last-used-age-ranges") {
      void handleFetchSuggestions(defaultParticipants.ageRanges);
      return;
    }
    const resolvedChildIds = personas
      .filter((p) => p.kind === "child" && defaultParticipants.participants.includes(p.id))
      .map((p) => p.id);
    const ageRangeValues = deriveAgeRangesFromChildren(childrenList, resolvedChildIds).map(
      (r) => r.range,
    );
    void handleFetchSuggestions(ageRangeValues);
  }, [defaultParticipants, needsAgeAnswerValues, personas, childrenList, handleFetchSuggestions]);

  const handleAgeAnswerConfirm = useCallback(
    (ageRanges: string[]) => {
      setNeedsAgeAnswerValues(ageRanges);
      setAwaitingAgeAnswer(false);
      writeLastPlanAgeRanges(ageRanges);
      onChangeSelectedAgeRanges(ageRanges.map((range) => ({ range, source: "manual" as const })));
      void handleFetchSuggestions(ageRanges);
    },
    [onChangeSelectedAgeRanges, handleFetchSuggestions],
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
    async (activity: PlanSuggestionItem) => {
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
          setAddedSuggestionActivityIds((prev) =>
            prev.includes(activity.id) ? prev : [...prev, activity.id],
          );
          setSuggestions((prev) => prev.filter((s) => s.id !== activity.id));
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

  useEffect(() => {
    setAddedSuggestionActivityIds((current) => {
      const reconciled = reconcileAddedActivityIds(
        current,
        inPlanActivityIds,
        serverPlanSnapshotConfirmed,
      );
      return reconciled.length === current.length && reconciled.every((id, i) => id === current[i])
        ? current
        : reconciled;
    });
  }, [inPlanActivityIds, serverPlanSnapshotConfirmed]);

  const dayItemsSorted = useMemo(
    () => sortPlanItemsForDay(dayItems),
    [dayItems],
  );

  const totalPlannedCount = useMemo(() => {
    const existingActivityIds = new Set(
      dayItems.map((item) => item.activityId).filter((value): value is string => Boolean(value)),
    );
    const pendingLocalAdds = addedSuggestionActivityIds.filter((id) => !existingActivityIds.has(id)).length;
    return dayItems.length + pendingLocalAdds;
  }, [dayItems, addedSuggestionActivityIds]);

  const scenarioCtaState = useMemo(
    () => resolveScenarioCtaState(totalPlannedCount, scenarioStatusByDate?.[selectedDate]),
    [totalPlannedCount, scenarioStatusByDate, selectedDate],
  );
  const scenarioCtaLabel = resolveScenarioCtaLabel(scenarioCtaState);

  const todayKey = todayIso ?? new Date().toISOString().split("T")[0];
  const slotLabel: Record<"morning" | "afternoon" | "evening", string> = {
    morning: "Утро",
    afternoon: "День",
    evening: "Вечер",
  };

  useEffect(() => {
    const draft = loadRecommendationDraft(recommendationDraftKeyValue);
    setSuggestions(draft?.suggestions ?? []);
    setSuggestionsGeneration(draft?.batchNumber ?? 0);
    setSuggestionsError(false);
    setAddedSuggestionActivityIds(draft?.addedActivityIds ?? []);
    lastAgeRangeValuesRef.current = draft?.ageRangeValues ?? [];
    shownSuggestionActivityIdsRef.current = new Set(draft?.shownActivityIds ?? []);
    hydratedDraftKeyRef.current = recommendationDraftKeyValue;
    skipNextDraftPersistRef.current = recommendationDraftKeyValue;
  }, [recommendationDraftKeyValue]);

  useEffect(() => {
    if (hydratedDraftKeyRef.current !== recommendationDraftKeyValue) return;
    if (skipNextDraftPersistRef.current === recommendationDraftKeyValue) {
      skipNextDraftPersistRef.current = null;
      return;
    }
    if (suggestionsGeneration === 0) {
      persistRecommendationDraft(recommendationDraftKeyValue, null, selectedDate);
      return;
    }
    persistRecommendationDraft(
      recommendationDraftKeyValue,
      {
        suggestions,
        batchNumber: suggestionsGeneration,
        addedActivityIds: addedSuggestionActivityIds,
        shownActivityIds: [...shownSuggestionActivityIdsRef.current],
        ageRangeValues: lastAgeRangeValuesRef.current,
        lastSuccessfulFetchAt: new Date().toISOString(),
      },
      selectedDate,
    );
  }, [recommendationDraftKeyValue, selectedDate, suggestions, suggestionsGeneration, addedSuggestionActivityIds]);

  const handleChangeChoice = useCallback(() => {
    setSuggestions([]);
    setSuggestionsGeneration(0);
    setSuggestionsError(false);
    shownSuggestionActivityIdsRef.current = new Set();
    persistRecommendationDraft(recommendationDraftKeyValue, null, selectedDate);
  }, [recommendationDraftKeyValue, selectedDate]);

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

  /** Только уже спланированные события — у них есть реальный startsAt, есть смысл группировать по слотам. */
  const dayPartSections = useMemo(() => {
    const sections: Record<"morning" | "afternoon" | "evening", PlanItemWithActivity[]> = {
      morning: [],
      afternoon: [],
      evening: [],
    };

    for (const item of dayItemsSorted) {
      const slot = slotFromStartsAt(item.startsAt) ?? "afternoon";
      sections[slot].push(item);
    }

    return (["morning", "afternoon", "evening"] as const)
      .map((slot) => ({
        slot,
        label: slotLabel[slot],
        items: sections[slot],
      }))
      .filter((section) => section.items.length > 0);
  }, [dayItemsSorted, slotFromStartsAt]);

  const hasRequestedSuggestions = suggestionsGeneration > 0 || isFetchingSuggestions;
  const showRecommendationResults = dayPartSections.length > 0 || hasRequestedSuggestions;
  /** Пул закончился раньше лимита подборок (включая «пусто уже с первой попытки»). */
  const suggestionsExhausted = suggestionsGeneration > 0 && !isFetchingSuggestions && suggestions.length === 0;

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

    return (
      <div
        id="plan-recommendation-results"
        className="space-y-4 outline-none"
        {...PLAN_RECOMMENDATION_RESULTS_A11Y}
      >
        {dayPartSections.length > 0 ? (
          <section className={compact ? "space-y-3" : "space-y-3"} aria-label="В вашем плане">
            {dayPartSections.map((section) => (
              <div key={section.slot} className="space-y-3">
                {section.items.map((item) => (
                  <RecommendationCard
                    key={item.id}
                    item={item}
                    isInPlan
                    onRemoveFromPlan={() => handleRemoveFromPlan(item.id)}
                  />
                ))}
              </div>
            ))}
          </section>
        ) : null}

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

        {isFetchingSuggestions ? (
          <div className="space-y-3">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="h-24 animate-pulse rounded-[24px] border border-neutral-200 bg-white p-4 shadow-sm"
              />
            ))}
          </div>
        ) : suggestionsError ? (
          <div className="rounded-[24px] border border-dashed border-neutral-300 bg-neutral-50 p-4 text-center">
            <p className="text-sm text-neutral-600">Не получилось загрузить рекомендации</p>
            <button
              type="button"
              onClick={() => void handleFetchSuggestions(lastAgeRangeValuesRef.current)}
              className="mt-2 text-sm font-medium text-primary underline-offset-2 hover:underline"
            >
              Попробовать снова
            </button>
          </div>
        ) : suggestions.length === 0 ? (
          <div className="rounded-[24px] border border-dashed border-neutral-300 bg-neutral-50 p-4 text-center">
            <p className="text-sm text-neutral-600">
              {buildEmptySuggestionsMessage(selectedDate, todayKey, lastAgeRangeValuesRef.current)}
            </p>
            <button
              type="button"
              onClick={handleScrollToCalendar}
              className="mt-2 text-sm font-medium text-primary underline-offset-2 hover:underline"
            >
              Выбрать другой день
            </button>
          </div>
        ) : (
          <section className={compact ? "space-y-3" : "space-y-3"}>
            {suggestions.map((activity) => (
              <RecommendationCard
                key={activity.id}
                item={mapSuggestionToPlanItem(activity, selectedDate)}
                onAddToPlan={() => void handleAddSuggestionToPlan(activity)}
              />
            ))}
          </section>
        )}
      </div>
    );
  };

  const renderBottomActions = () => (
    <div className="space-y-3">
      {scenarioCtaLabel ? (
        <BuildScenarioButton
          onClick={handleOpenScenarioPage}
          label={scenarioCtaLabel}
          hint={
            scenarioCtaState === "create"
              ? "Соберем из добавленных событий красивый маршрут дня"
              : undefined
          }
        />
      ) : null}
    </div>
  );

  const renderRecommendationContext = () =>
    suggestionsGeneration > 0 ? (
      <div className="flex items-center justify-between gap-3 rounded-2xl bg-[#FFF4EE] px-3 py-2">
        <div className="min-w-0">
          <span className="inline-flex rounded-full bg-white px-2.5 py-1 text-xs font-medium text-primary shadow-sm">
            Реши за меня
          </span>
          <p className="mt-1 truncate text-xs text-neutral-600">
            {suggestions.length} идеи · подборка {suggestionsGeneration}
          </p>
        </div>
        <button
          type="button"
          onClick={handleChangeChoice}
          className="shrink-0 rounded-full px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          Изменить выбор
        </button>
      </div>
    ) : null;

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
            <div id="plan-week-calendar">
              <WeekCalendarStrip
                selectedDate={selectedDate}
                onChangeDate={onChangeDate}
                showArrows
                plannedCountByDate={plannedCountByDate}
              />
            </div>
          ) : null}

          {upcomingSelection ? (
            <UpcomingPlanBlock
              items={upcomingSelection.items}
              totalCount={upcomingSelection.count}
              onNavigate={onRequestClose}
            />
          ) : null}

          {renderRecommendationContext()}

          {awaitingAgeAnswer ? (
            <PlanNeedsAgeQuestion onConfirm={handleAgeAnswerConfirm} onCancel={handleAgeAnswerCancel} />
          ) : suggestionsGeneration === 0 ? (
            <RecommendationDecisionBlock
              onDecide={handleDecideClick}
              onCatalog={handleOpenCatalog}
              isGenerating={isFetchingSuggestions}
            />
          ) : null}

          {renderRecommendationArea(false)}

          {suggestionsGeneration > 0 ? (
            <PlanRecommendationCta
              onRegenerate={handleDecideClick}
              onCatalog={handleOpenCatalog}
              isRegenerating={isFetchingSuggestions}
              batchNumber={suggestionsGeneration}
              maxBatches={MAX_SUGGESTION_BATCHES}
              isExhausted={suggestionsExhausted}
            />
          ) : null}

          {renderBottomActions()}
        </div>

        <PlanStickyCounter count={totalPlannedCount} onClick={handleOpenPlanPage} />

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
          <div id="plan-week-calendar">
            <WeekCalendarStrip
              selectedDate={selectedDate}
              onChangeDate={onChangeDate}
              compact
              plannedCountByDate={plannedCountByDate}
            />
          </div>
        ) : null}

        {upcomingSelection ? (
          <UpcomingPlanBlock
            items={upcomingSelection.items}
            totalCount={upcomingSelection.count}
            onNavigate={onRequestClose}
          />
        ) : null}

        {renderRecommendationContext()}

        {awaitingAgeAnswer ? (
          <PlanNeedsAgeQuestion onConfirm={handleAgeAnswerConfirm} onCancel={handleAgeAnswerCancel} compact />
        ) : suggestionsGeneration === 0 ? (
          <RecommendationDecisionBlock
            onDecide={handleDecideClick}
            onCatalog={handleOpenCatalog}
            isGenerating={isFetchingSuggestions}
            compact
          />
        ) : null}

        {renderRecommendationArea(true)}

        {suggestionsGeneration > 0 ? (
          <PlanRecommendationCta
            onRegenerate={handleDecideClick}
            onCatalog={handleOpenCatalog}
            isRegenerating={isFetchingSuggestions}
            batchNumber={suggestionsGeneration}
            maxBatches={MAX_SUGGESTION_BATCHES}
            isExhausted={suggestionsExhausted}
            compact
          />
        ) : null}

        {renderBottomActions()}
      </div>

      <PlanStickyCounter count={totalPlannedCount} onClick={handleOpenPlanPage} compact />

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
    </div>
  );
}
