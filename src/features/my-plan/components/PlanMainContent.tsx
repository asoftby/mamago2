"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { PlanItemRow } from "./PlanItemRow";
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
import { cn } from "@/lib/utils";
import { LiquidNotification } from "@/components/ui/liquid-notification";
import { PlanCalendar } from "@/features/plan-calendar";
import { PlanPersonFilter, planPersonFilterOptions } from "./PlanPersonFilter";
import { useSharedPlanAudienceFilters } from "../hooks/useSharedPlanAudienceFilters";
import { PlanEmptyDayMessage } from "./PlanEmptyDayMessage";
import { filterVisiblePlanEntries, type PlanPersonSelection } from "../lib/filterPlanEntriesByPerson";
import { pluralRu } from "@/lib/date/dateKey";
import { publicActivityPath } from "@/lib/business/eventPublicLink";
import { QuickAddChildModal } from "@/components/children/QuickAddChildModal";
import { AddPersonaTypeModal } from "./AddPersonaTypeModal";
import { AddParticipantModal } from "@/components/children/AddParticipantModal";
import { MyPlanHeader } from "./MyPlanHeader";
import { PlanStickyCounter } from "./PlanStickyCounter";
import { PlanArticleScreen } from "./v3/PlanArticleScreen";
import { PlanEventScreen } from "./v3/PlanEventScreen";
import { PlanScenarioScreen } from "./v3/PlanScenarioScreen";
import { PlanNewTaskScreen } from "./v3/PlanNewTaskScreen";
import { PlanVisitsScreen } from "./v3/PlanVisitsScreen";
import { PlanDayRibbon } from "./v3/PlanDayRibbon";
import { PlanFeedbackCard } from "./v3/PlanFeedbackCard";
import { PlanMonthScreen } from "./v3/PlanMonthScreen";
import { PlanPicksScreen } from "./v3/PlanPicksScreen";
import { PlanMoveSheet, canMovePlanItem } from "./v3/PlanMoveSheet";
import { fetchPlanExperienceFeed, type PlanExperienceFeed } from "./v3/planExperienceApi";
import { ArrowRight, Bookmark, Heart, Lightbulb, Search } from "lucide-react";
import { formatPriceFrom, normalizeUiCurrencyText } from "@/lib/formatters/format-price";
import { MAX_SUGGESTION_BATCHES } from "../lib/suggestionsConfig";
import { PlanNeedsAgeQuestion } from "./PlanNeedsAgeQuestion";
import { BuildScenarioButton } from "./BuildScenarioButton";
import { resolveScenarioCtaState, resolveScenarioCtaLabel } from "../lib/canOpenDayScenario";
import { sortPlanItemsForDay } from "../lib/sortPlanItemsForDay";
import { useResolveDefaultParticipants } from "../lib/useResolveDefaultParticipants";
import { writeLastPlanAgeRanges } from "../lib/lastPlanAgeRangesStorage";
import { toggleAgeRangeSelection } from "../lib/ageRangeSelection";
import { AGE_GROUPS } from "@/features/filters/age/ageGroups";
import {
  fetchPlanSuggestions,
  createPlanSuggestionAudienceSnapshot,
  type PlanSuggestionAudienceSnapshot,
  type PlanSuggestionItem,
} from "../lib/fetchPlanSuggestions";
import {
  loadRecommendationDraft,
  persistRecommendationDraft,
  recommendationDraftKey,
  reconcileAddedActivityIds,
} from "../lib/planRecommendationDraftStorage";
import { focusPlanRecommendationResults } from "../lib/planRecommendationUi";

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
  currentWeekItems?: PlanItemWithActivity[];
  currentWeekItemsCount?: number;
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
  /** Всего сохранённых идей пользователя (для «Мои идеи · N»); null — ещё не загружено. */
  ideasCount?: number | null;
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

/** «сегодня» / «завтра» / «среду, 4 ноября» — для подписи «Активности на …». */
function posterDayWord(selectedDate: string, todayKey: string): string {
  if (selectedDate === todayKey) return "сегодня";
  if (selectedDate === addDaysIso(todayKey, 1)) return "завтра";
  const date = new Date(`${selectedDate}T12:00:00`);
  return `${weekdayForNa(date)}, ${date.toLocaleDateString("ru-RU", { day: "numeric", month: "long" })}`;
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

function PlanDeleteCountdownToast({
  toastId,
  onUndo,
  onExpire,
}: {
  toastId: string;
  onUndo: () => void;
  onExpire: () => void;
}) {
  const [seconds, setSeconds] = useState(5);

  useEffect(() => {
    const timers = [1, 2, 3, 4].map((elapsedSeconds) =>
      window.setTimeout(() => setSeconds(5 - elapsedSeconds), elapsedSeconds * 1000),
    );
    const expireTimer = window.setTimeout(() => {
      onExpire();
      toast.dismiss(toastId);
    }, 5000);

    return () => {
      for (const timer of timers) window.clearTimeout(timer);
      window.clearTimeout(expireTimer);
    };
  }, [onExpire, toastId]);

  return (
    <div data-plan-delete-toast>
      <LiquidNotification
        variant="brand"
        title={`Удаление через ${seconds} сек.`}
        actionLabel="Отменить"
        onAction={() => {
          onUndo();
          toast.dismiss(toastId);
        }}
      />
    </div>
  );
}

export function PlanMainContent({
  selectedDate,
  onChangeDate,
  planItemsByDate,
  scenarioStatusByDate,
  nearestPlanDate = null,
  nearestPlanCount = 0,
  nearestPlanItems = [],
  currentWeekItems = [],
  currentWeekItemsCount = 0,
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
  ideasCount = null,
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
  const [showAddPersonaTypeModal, setShowAddPersonaTypeModal] = useState(false);
  const [showAdultParticipantModal, setShowAdultParticipantModal] = useState(false);
  const [showAudienceSheet, setShowAudienceSheet] = useState(false);
  /** Два экрана остаются в одной модалке: сдвигаем их по горизонтали, не теряя план. */
  const [screen, setScreen] = useState<"plan" | "new" | "visits" | "month" | "picks" | "event" | "scenario">("plan");
  /** Сохраняем исходящий экран в DOM до конца обратной анимации. */
  const [mountedNestedScreen, setMountedNestedScreen] = useState<"new" | "visits" | "month" | "picks" | "event" | "scenario" | null>(null);
  /** Каждое открытие формы — новый экземпляр; отменённая анимация не оставляет старый черновик. */
  const [nestedScreenVersion, setNestedScreenVersion] = useState(0);
  const openNestedScreen = useCallback((next: "new" | "visits" | "month" | "picks" | "event" | "scenario") => {
    setNestedScreenVersion((version) => version + 1);
    setMountedNestedScreen(next);
    setScreen(next);
  }, []);
  const closeNestedScreen = useCallback(() => setScreen("plan"), []);

  useEffect(() => {
    if (screen !== "plan" || mountedNestedScreen === null) return;
    const timeout = window.setTimeout(() => setMountedNestedScreen(null), 350);
    return () => window.clearTimeout(timeout);
  }, [screen, mountedNestedScreen]);
  const [movingItem, setMovingItem] = useState<PlanItemWithActivity | null>(null);
  /** Своя заметка, открытая тапом: та же форма «Новое дело», предзаполненная. */
  const [editingNote, setEditingNote] = useState<PlanItemWithActivity | null>(null);
  const [openedEventId, setOpenedEventId] = useState<string | null>(null);
  /** Открытое событие ищем по всем датам: после переноса оно остаётся на экране до «Назад». */
  const openedEvent = useMemo(() => {
    if (!openedEventId) return null;
    for (const items of Object.values(planItemsByDate ?? {})) {
      const found = items.find((candidate) => candidate.id === openedEventId);
      if (found) return found;
    }
    return null;
  }, [openedEventId, planItemsByDate]);
  /** Selection lives in useSharedPlanAudienceFilters, not in a second stale state. */
  const { filters: audienceFilters, update: updateAudienceFilters } = useSharedPlanAudienceFilters(family?.primaryAdultPersonaId);
  const includedPeople = audienceFilters.include;
  const excludedPeople = audienceFilters.exclude;
  // Вкладки «Все доступные / Мои личные / Общие» в виджете пока скрыты: сохранённый фильтр не должен прятать дела.
  const planVisibilityFilter: typeof audienceFilters.visibility = "ALL";
  const [familyAdults, setFamilyAdults] = useState<Array<{ userId: string; displayName: string | null; avatarUrl?: string | null; isMe: boolean }>>([]);
  useEffect(() => {
    if (!family?.primaryAdultPersonaId) { setFamilyAdults([]); return; }
    const controller = new AbortController();
    fetch("/api/family", { credentials: "include", cache: "no-store", signal: controller.signal })
      .then(res => res.ok ? res.json() as Promise<{ family?: { adults?: Array<{ userId: string; displayName: string | null; avatarUrl?: string | null; isMe: boolean }> } }> : null)
      .then(data => { if (!controller.signal.aborted) setFamilyAdults(data?.family?.adults ?? []); })
      .catch(() => { if (!controller.signal.aborted) setFamilyAdults([]); });
    return () => controller.abort();
  }, [family?.primaryAdultPersonaId]);
  const [experienceFeed, setExperienceFeed] = useState<PlanExperienceFeed | null>(null);
  const reloadExperienceFeed = useCallback(async () => {
    setExperienceFeed(await fetchPlanExperienceFeed());
  }, []);
  useEffect(() => {
    void reloadExperienceFeed();
  }, [reloadExperienceFeed]);
  const [hiddenPlanItemIds, setHiddenPlanItemIds] = useState<Set<string>>(() => new Set());
  const pendingRemovalIdsRef = useRef<Set<string>>(new Set());
  const [awaitingAgeAnswer, setAwaitingAgeAnswer] = useState(false);
  const [needsAgeAnswerValues, setNeedsAgeAnswerValues] = useState<string[] | null>(null);
  /** Реальные саджесты из /api/plan/suggestions (M2.4) — не клиентский demo-пул. */
  const [suggestions, setSuggestions] = useState<PlanSuggestionItem[]>([]);
  const [suggestionsGeneration, setSuggestionsGeneration] = useState(0);
  /** Selection local to plan recommendations, separate from global discovery filters. */
  const [planAudienceOverride, setPlanAudienceOverride] = useState<string[] | null>(null);
  const [isFetchingSuggestions, setIsFetchingSuggestions] = useState(false);
  const [suggestionsError, setSuggestionsError] = useState(false);
  const [picksPeople, setPicksPeople] = useState<string[]>([]);
  const [picksAges, setPicksAges] = useState<string[]>([]);
  const [addedSuggestionActivityIds, setAddedSuggestionActivityIds] = useState<string[]>([]);
  const lastRequestSnapshotRef = useRef<PlanSuggestionAudienceSnapshot>({
    ageRangeValues: [],
    personaIds: [],
  });
  /** Все id, когда-либо показанные в подборках этого сеанса — не даём «Ещё варианты» повторяться. */
  const shownSuggestionActivityIdsRef = useRef<Set<string>>(new Set());
  const hydratedDraftKeyRef = useRef<string | null>(null);
  const skipNextDraftPersistRef = useRef<string | null>(null);

  const restorePendingPlanItem = useCallback((itemId: string) => {
    pendingRemovalIdsRef.current.delete(itemId);
    setHiddenPlanItemIds((current) => {
      if (!current.has(itemId)) return current;
      const next = new Set(current);
      next.delete(itemId);
      return next;
    });
  }, []);

  const commitPendingPlanItemRemoval = useCallback(async (itemId: string) => {
    if (!onRemoveItemFromPlan || !pendingRemovalIdsRef.current.has(itemId)) return;
    pendingRemovalIdsRef.current.delete(itemId);
    try {
      const result = onRemoveItemFromPlan(itemId);
      const ok = result instanceof Promise ? await result : true;
      if (!ok) {
        restorePendingPlanItem(itemId);
        toast.error("Не получилось убрать из плана");
      }
    } catch {
      restorePendingPlanItem(itemId);
      toast.error("Не получилось убрать из плана");
    }
  }, [onRemoveItemFromPlan, restorePendingPlanItem]);

  const handleRemoveFromPlan = useCallback((itemId: string) => {
    if (!onRemoveItemFromPlan || pendingRemovalIdsRef.current.has(itemId)) return;

    pendingRemovalIdsRef.current.add(itemId);
    setHiddenPlanItemIds((current) => {
      const next = new Set(current);
      next.add(itemId);
      return next;
    });

    const toastId = `plan-delete-${itemId}`;
    let resolved = false;

    const undo = () => {
      if (resolved) return;
      resolved = true;
      restorePendingPlanItem(itemId);
    };

    const expire = () => {
      if (resolved) return;
      resolved = true;
      void commitPendingPlanItemRemoval(itemId);
    };

    toast.custom(
      () => (
        <PlanDeleteCountdownToast
          toastId={toastId}
          onUndo={undo}
          onExpire={expire}
        />
      ),
      {
        id: toastId,
        duration: Infinity,
        onDismiss: undo,
        className:
          "!w-auto !max-w-none !border-0 !bg-transparent !p-0 !shadow-none pointer-events-auto",
      },
    );
  }, [commitPendingPlanItemRemoval, onRemoveItemFromPlan, restorePendingPlanItem]);



  // Resolve the real family profile (and last explicitly used plan audience)
  // before rendering the picker or building the draft key.
  const defaultParticipants = useResolveDefaultParticipants();
  const personas = useMemo(() => family?.personas ?? [], [family?.personas]);
  const planAudienceIds = useMemo(
    () => planAudienceOverride ?? (
      defaultParticipants.source === "last-used" || defaultParticipants.source === "profile"
        ? defaultParticipants.participants
        : []
    ),
    [defaultParticipants, planAudienceOverride],
  );

  /**
   * Полный список выбранных персон (взрослые + дети) из FamilyPersonaContext
   */
  const selectedPersonaIds = useMemo(() => {
    if (!family?.selectedPersonaIds) return [];
    return family.selectedPersonaIds;
  }, [family?.selectedPersonaIds]);
  const recommendationDraftKeyValue = useMemo(
    () => recommendationDraftKey({ citySlug: city, date: selectedDate, audienceIds: planAudienceIds }),
    [city, selectedDate, planAudienceIds],
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

  /** «Собрать сценарий дня» — переход на отдельную страницу, а не модалка поверх модалки. */
  const handleOpenScenarioPage = useCallback(() => {
    onRequestClose?.();
    window.setTimeout(() => {
      router.push(`/${city}/my-plan/${selectedDate}/scenario`);
    }, 0);
  }, [city, onRequestClose, router, selectedDate]);

  const dayItems = useMemo(
    () => (planItemsByDate?.[selectedDate] ?? []).filter((item) => !hiddenPlanItemIds.has(item.id)),
    [hiddenPlanItemIds, planItemsByDate, selectedDate],
  );

  useEffect(() => {
    const existingIds = new Set(
      Object.values(planItemsByDate ?? {})
        .flat()
        .map((item) => item.id),
    );
    setHiddenPlanItemIds((current) => {
      let changed = false;
      const next = new Set<string>();
      for (const id of current) {
        if (existingIds.has(id)) next.add(id);
        else changed = true;
      }
      return changed ? next : current;
    });
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

  /**
   * Реальный fetch /api/plan/suggestions (M2.4) — параметры передаются явно вызывающим
   * кодом, не через реактивный стор, чтобы не зависеть от отстающего на кадр состояния
   * (тот же принцип, что уже применён для family.setSelectedPersonaIds в M2).
   * Исключает не только уже добавленные в план, но и всё, что уже показывалось в
   * этом сеансе (shownSuggestionActivityIdsRef) — «Ещё варианты» не повторяет офферы.
   */
  const handleFetchSuggestions = useCallback(
    async (snapshot: PlanSuggestionAudienceSnapshot) => {
      const requestSnapshot = {
        ageRangeValues: [...snapshot.ageRangeValues],
        personaIds: [...snapshot.personaIds],
      };
      lastRequestSnapshotRef.current = requestSnapshot;
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
          ...requestSnapshot,
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

  /**
   * Слой 0: «Реши за меня» — намерение сначала, состав правится после выдачи (M3).
   * Возраст для запроса выводится из резолвленного состава напрямую (не через
   * family.setSelectedPersonaIds) — синхронный вызов setSelectedPersonaIds из этого
   * клика попадал под effect ниже, который сбрасывает выдачу при смене selectedPersonaIds.
   */
  const handleDecideClick = useCallback(() => {
    // The visible chips are the actual request audience, never an invisible
    // global-filter selection. An explicit empty set means no age restriction.
    if (planAudienceOverride !== null ||
        defaultParticipants.source === "last-used" ||
        defaultParticipants.source === "profile") {
      const childIds = personas
        .filter((persona) => persona.kind === "child" && planAudienceIds.includes(persona.id))
        .map((persona) => persona.id);
      const ages = childIds.length === 0 && planAudienceIds.length > 0
        ? ["18+"]
        : deriveAgeRangesFromChildren(childrenList, childIds).map((item) => item.range);
      void handleFetchSuggestions(createPlanSuggestionAudienceSnapshot(ages, planAudienceIds));
      return;
    }

    if (defaultParticipants.source === "last-used-age-ranges") {
      void handleFetchSuggestions(createPlanSuggestionAudienceSnapshot(defaultParticipants.ageRanges, []));
      return;
    }
    if (needsAgeAnswerValues?.length) {
      void handleFetchSuggestions(createPlanSuggestionAudienceSnapshot(needsAgeAnswerValues, []));
      return;
    }
    setAwaitingAgeAnswer(true);
  }, [planAudienceOverride, planAudienceIds, defaultParticipants, personas, childrenList, needsAgeAnswerValues, handleFetchSuggestions]);

  const handleAgeAnswerConfirm = useCallback(
    (ageRanges: string[]) => {
      setNeedsAgeAnswerValues(ageRanges);
      setAwaitingAgeAnswer(false);
      writeLastPlanAgeRanges(ageRanges);
      onChangeSelectedAgeRanges(ageRanges.map((range) => ({ range, source: "manual" as const })));
      void handleFetchSuggestions(createPlanSuggestionAudienceSnapshot(ageRanges, []));
    },
    [onChangeSelectedAgeRanges, handleFetchSuggestions],
  );

  const handleAgeAnswerCancel = useCallback(() => {
    setAwaitingAgeAnswer(false);
  }, []);

  const handleRegenerate = useCallback(() => {
    if (suggestionsGeneration > 0) {
      void handleFetchSuggestions(lastRequestSnapshotRef.current);
      return;
    }
    handleDecideClick();
  }, [handleDecideClick, handleFetchSuggestions, suggestionsGeneration]);

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
  const handleOpenMyIdeas = useCallback(() => {
    onRequestClose?.();
    window.setTimeout(() => {
      router.push("/me/ideas");
    }, 0);
  }, [onRequestClose, router]);
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

  const audienceSelection = useMemo(() => {
    const person = (id: string): PlanPersonSelection | null => {
      // Unknown saved selections must stay restrictive: do not turn a removed
      // family member's filter into "all". The server already enforces ACL.
      if (id.startsWith("adult:") && id.length > 6) {
        return { kind: "adult", id: id.slice(6) };
      }
      if (id.startsWith("child:") && id.length > 6) {
        return { kind: "child", id: id.slice(6) };
      }
      return null;
    };
    return {
      include: includedPeople.map(person).filter((p): p is PlanPersonSelection => Boolean(p)),
      exclude: excludedPeople.map(person).filter((p): p is PlanPersonSelection => Boolean(p)),
      visibility: planVisibilityFilter,
    };
  }, [includedPeople, excludedPeople, planVisibilityFilter]);

  const visibleDayItems = useMemo(
    () => filterVisiblePlanEntries(dayItemsSorted, audienceSelection),
    [dayItemsSorted, audienceSelection],
  );
  const visibleCurrentWeekItems = useMemo(() =>
    filterVisiblePlanEntries(currentWeekItems.filter(item => !hiddenPlanItemIds.has(item.id)), audienceSelection),
    [currentWeekItems, hiddenPlanItemIds, audienceSelection],
  );
  const currentWeekCount =
    includedPeople.length === 0 && excludedPeople.length === 0 && planVisibilityFilter === "ALL" && hiddenPlanItemIds.size === 0
      ? currentWeekItemsCount
      : visibleCurrentWeekItems.length;

  const totalPlannedCount = useMemo(() => {
    const existingActivityIds = new Set(
      dayItems.map((item) => item.activityId).filter((value): value is string => Boolean(value)),
    );
    const pendingLocalAdds = addedSuggestionActivityIds.filter((id) => !existingActivityIds.has(id)).length;
    return dayItems.length + pendingLocalAdds;
  }, [dayItems, addedSuggestionActivityIds]);

  const scenarioCtaState = useMemo(
    () => process.env.NEXT_PUBLIC_ENABLE_LEGACY_DAY_SCENARIO === "true"
      ? resolveScenarioCtaState(totalPlannedCount, scenarioStatusByDate?.[selectedDate])
      : "hidden" as const,
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
    lastRequestSnapshotRef.current = {
      ageRangeValues: draft?.ageRangeValues ?? [],
      personaIds: draft?.personaIds ?? [],
    };
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
        ageRangeValues: lastRequestSnapshotRef.current.ageRangeValues,
        personaIds: lastRequestSnapshotRef.current.personaIds,
        lastSuccessfulFetchAt: new Date().toISOString(),
      },
      selectedDate,
    );
  }, [recommendationDraftKeyValue, selectedDate, suggestions, suggestionsGeneration, addedSuggestionActivityIds]);


  /** Только уже спланированные события — у них есть реальный startsAt, есть смысл группировать по слотам. */
  const dayPartSections = useMemo(() => {
    const sections: Record<"morning" | "afternoon" | "evening", PlanItemWithActivity[]> = {
      morning: [],
      afternoon: [],
      evening: [],
    };

    for (const item of visibleDayItems) {
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
  }, [visibleDayItems, slotFromStartsAt]);

  const hasRequestedSuggestions = suggestionsGeneration > 0 || isFetchingSuggestions;
  // One calendar for both layouts: strip vs week row is chosen by container width.
  const planCalendar = onChangeDate ? (
    <PlanDayRibbon
      value={selectedDate}
      onChange={onChangeDate}
      onOpenMonth={() => openNestedScreen("month")}
      monthEnd={addDaysIso(`${selectedDate.slice(0, 7)}-01`, new Date(Number(selectedDate.slice(0, 4)), Number(selectedDate.slice(5, 7)), 0).getDate() - 1)}
    />
  ) : null;
  const isPastDay = selectedDate < todayKey;
  const isTodaySelected = selectedDate === todayKey;
  const filteredAudience = includedPeople.length > 0 || excludedPeople.length > 0 || planVisibilityFilter !== "ALL";
  const filterPerson = includedPeople.length === 1 && excludedPeople.length === 0
    ? (() => {
        const token = includedPeople[0]!;
        const userId = token.slice(6);
        if (token.startsWith("adult:")) {
          const adult = familyAdults.find((member) => member.userId === userId);
          return { kind: "adult" as const, displayName: adult?.isMe ? "Я" : adult?.displayName?.trim() || "Участник семьи" };
        }
        if (token.startsWith("child:")) return personas.find((persona) => persona.kind === "child" && persona.id === userId) ?? null;
        return null;
      })()
    : null;
  const personShortName = (persona: { kind: string; displayName?: string | null }) =>
    persona.displayName?.trim() || (persona.kind === "adult" ? "Я" : "");
  const dayContextLabel = (() => {
    // «Сегодня, 31 октября» / «Завтра, 1 ноября» / «Среда, 4 ноября».
    const dayDate = new Date(`${selectedDate}T12:00:00`);
    const datePart = dayDate.toLocaleDateString("ru-RU", { day: "numeric", month: "long" });
    const weekdayName = dayDate.toLocaleDateString("ru-RU", { weekday: "long" });
    const label = selectedDate === todayKey
      ? `Сегодня, ${datePart}`
      : selectedDate === addDaysIso(todayKey, 1)
        ? `Завтра, ${datePart}`
        : `${weekdayName.charAt(0).toUpperCase()}${weekdayName.slice(1)}, ${datePart}`;
    return filterPerson ? `${label} · ${filterPerson.kind === "adult"
      ? (personShortName(filterPerson) === "Я" ? "мои дела" : `дела: ${personShortName(filterPerson)}`)
      : personShortName(filterPerson)}` : label;
  })();

  const personFilterOptions = planPersonFilterOptions([
    ...familyAdults.map(adult => ({
      value: `adult:${adult.userId}`,
      label: adult.isMe ? "Я" : adult.displayName?.trim() || "Взрослый",
      avatarUrl: adult.avatarUrl,
    })),
    ...personas.filter(persona => persona.kind === "child").map(persona => ({
      value: `child:${persona.id}`,
      label: personShortName(persona) || "Ребёнок",
    })),
    ...(!familyAdults.length && family?.primaryAdultPersonaId ? [{ value: `adult:${family.primaryAdultPersonaId}`, label: "Я" }] : []),
  ]);

  /** Same filter UI as /me/plan, only the outer spacing depends on the sheet. */
  const renderPersonFilter = (_compact: boolean) =>
    personFilterOptions.length < 2 ? null : (
      <PlanPersonFilter
        options={personFilterOptions}
        selectedValues={includedPeople}
        onAudienceChange={({ include, exclude }) => updateAudienceFilters({ ...audienceFilters, include, exclude })}
        excludedValues={excludedPeople}
      />
    );

  const renderDayPlanSection = (compact: boolean) => {
    const rows = dayPartSections.flatMap((section) => section.items);
    const timedRows = rows.filter((item) => item.startsAt);
    const untimedRows = rows.filter((item) => !item.startsAt);
    const nowMs = Date.now();
    const nowIndex = isTodaySelected
      ? timedRows.findIndex((item) => new Date(item.startsAt!).getTime() > nowMs)
      : -2;
    const nowLabel = new Date(nowMs).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit", hour12: false });
    const renderRow = (item: PlanItemWithActivity) => (
      <PlanItemRow
        key={item.id}
        item={item}
        participantLabel={
          item.childId
            ? childrenList.find((child) => child.id === item.childId)?.name ?? null
            : item.assigneeUserId
              ? (familyAdults.find((adult) => adult.userId === item.assigneeUserId)?.displayName?.trim() || personas.find((persona) => persona.id === item.assigneeUserId)?.displayName?.trim() || "Взрослый")
              : null
        }
        authorLabel={familyAdults.length > 1 && item.userId !== family?.primaryAdultPersonaId
          ? familyAdults.find((adult) => adult.userId === item.userId)?.displayName?.trim() || "другой взрослый"
          : null}
        onRemove={() => handleRemoveFromPlan(item.id)}
        onMove={canMovePlanItem(item) && !isPastDay ? () => setMovingItem(item) : undefined}
        onOpen={() => {
          if (item.source === "MANUAL") {
            setEditingNote(item);
            openNestedScreen("new");
            return;
          }
          setOpenedEventId(item.id);
          openNestedScreen("event");
        }}
      />
    );
    const nowLine = (
      <div key="now-line" role="separator" aria-label={`Сейчас ${nowLabel}`} className="relative mx-1 my-0.5 flex items-center gap-2.5">
        <span className="mp-font-meta inline-flex h-[24px] items-center rounded-full bg-[var(--mp-ac)] px-2.5 text-[11px] font-semibold tabular-nums text-white">{nowLabel}</span>
        <i className="relative h-0.5 flex-1 rounded-sm bg-[var(--mp-ac)] before:absolute before:-left-1 before:-top-[3px] before:h-2 before:w-2 before:rounded-full before:bg-[var(--mp-ac)]" />
        <span className="mp-font-meta text-[10px] font-medium uppercase tracking-[.14em] text-[var(--mp-ac-dark)]">сейчас</span>
      </div>
    );
    return (
      <section aria-label="В вашем плане">
        <h3 className={(compact ? "mb-3" : "mb-2.5") + " mx-0.5 mt-1 text-[18px] font-semibold tracking-[-.01em] text-[var(--mp-tx)]"}>{dayContextLabel}</h3>
        <div className="space-y-2">
          {timedRows.map((item, index) => (
            <div key={item.id} className="space-y-2">
              {index === nowIndex ? nowLine : null}
              {renderRow(item)}
            </div>
          ))}
          {nowIndex === -1 && timedRows.length > 0 ? nowLine : null}
        </div>
        {untimedRows.length > 0 ? (
          <>
            <p className="mp-font-meta mx-1 mb-2.5 mt-[18px] text-[10px] font-medium uppercase tracking-[.1em] text-[var(--mp-tx2)]">В любое время</p>
            <div className="space-y-2">{untimedRows.map(renderRow)}</div>
          </>
        ) : null}
      </section>
    );
  };

  /** Past days: records only — no recommendations, decision fork or scenario CTA. */
  const renderPastDay = (compact: boolean) =>
    isPendingDateHydration ? null : (
      <div className="space-y-3">
        {dayPartSections.length > 0 ? (
          renderDayPlanSection(compact)
        ) : (
          <p
            role="status"
            className="rounded-2xl border border-[var(--mp-line)] bg-[var(--mp-card)] p-[18px] text-center text-[15px] leading-6 text-[var(--mp-tx2)]"
          >
            В этот день записей не было
          </p>
        )}
      </div>
    );

  /** Экран подборки; саму подборку запрашиваем, только если её ещё не было. */
  const openPicks = () => {
    openNestedScreen("picks");
    if (!hasRequestedSuggestions) handleDecideClick();
  };

  /** Список дня: записи по времени либо спокойный пустой день. */
  const renderDayList = (compact: boolean) => {
    if (isPendingDateHydration) {
      return (
        <div className="animate-pulse rounded-[18px] border border-[var(--mp-line)] bg-[var(--mp-card)] p-4">
          <div className="h-4 w-44 rounded bg-[var(--surface-hover)]" />
          <div className="mt-3 h-3 w-52 rounded bg-[var(--surface-hover)]" />
        </div>
      );
    }
    if (dayPartSections.length > 0) return renderDayPlanSection(compact);
    const emptyHeading = (
      <h3 className={(compact ? "mb-3" : "mb-2.5") + " mx-0.5 mt-1 text-[18px] font-semibold tracking-[-.01em] text-[var(--mp-tx)]"}>{dayContextLabel}</h3>
    );
    if (!filteredAudience && !isPastDay) {
      return (
        <section aria-label="В вашем плане" className="pb-2">
          {emptyHeading}
          <p role="status" className="m-0 flex min-h-[76px] items-center justify-center rounded-[22px] border border-[#d6e4f3] bg-[#eaf2fb] px-4 py-3 text-center text-[14px] font-normal leading-[1.5] text-[var(--mp-tx2)]">
            На {isTodaySelected ? "сегодня" : selectedDate === addDaysIso(todayKey, 1) ? "завтра" : "этот день"} планов нет.
          </p>
        </section>
      );
    }
    return (
      <div role="status" className="rounded-2xl border border-[var(--mp-line)] bg-[var(--mp-card)] p-[18px] text-[15.5px] leading-[1.5] text-[var(--mp-tx2)]">
        {filteredAudience ? (
          <>
            <b className="font-bold text-[var(--mp-tx)]">
              {filterPerson?.kind === "adult" && personShortName(filterPerson) === "Я"
                ? "У вас в этот день свободно."
                : filterPerson?.kind === "child"
                  ? `У ${toGenitiveName(personShortName(filterPerson))} в этот день свободно.`
                  : "Нет дел по выбранным фильтрам."}
            </b>{" "}
            <button type="button" onClick={() => updateAudienceFilters({ include: [], exclude: [], visibility: "ALL" })} className="font-bold text-[var(--mp-ac-dark)] underline underline-offset-[3px]">
              Сбросить фильтры
            </button>
          </>
        ) : (
          <>
            <PlanEmptyDayMessage />
          </>
        )}
      </div>
    );
  };

  const ideaMeta = (activity: PlanSuggestionItem) => {
    const text = activity.priceText?.trim();
    const price = text
      ? normalizeUiCurrencyText(text)
      : activity.priceFrom === 0
        ? "Бесплатно"
        : activity.priceFrom != null && !Number.isNaN(activity.priceFrom)
          ? formatPriceFrom(activity.priceFrom)
          : null;
    return [activity.ageLabel ?? null, price].filter(Boolean).join(" · ");
  };

  /** Пустой день: 1–2 сохранённые идеи с кнопкой «Запланировать на {дата}» (тот же механизм, что «+» у идей). */
  const renderOwnIdeas = () => {
    if (isPendingDateHydration || isPastDay || dayPartSections.length > 0 || filteredAudience) return null;
    const dayActivityIds = new Set((planItemsByDate?.[selectedDate] ?? []).map((item) => item.activityId));
    const candidates = ideas
      .filter((idea) => !idea.inPlanOnDate && !dayActivityIds.has(idea.activityId))
      .slice(0, 2);
    if (candidates.length === 0) return null;
    const dayLabel = new Date(`${selectedDate}T12:00:00`).toLocaleDateString("ru-RU", { day: "numeric", month: "long" });
    return (
      <section aria-label="Из ваших идей" className="space-y-2">
        <b className="block px-0.5 text-[15px] font-bold text-[var(--mp-tx)]">Из ваших идей</b>
        {candidates.map((idea) => {
          const poster = idea.activity.coverImageUrl;
          return (
            <div key={idea.id} className="rounded-2xl border border-[var(--mp-line)] bg-[var(--mp-card)] p-3">
              <div className="flex min-w-0 items-center gap-3">
                {poster ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={poster} alt="" className="h-12 w-12 shrink-0 rounded-xl object-cover" />
                ) : (
                  <span aria-hidden className="h-12 w-12 shrink-0 rounded-xl bg-[var(--mp-soft)]" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="m-0 line-clamp-2 text-[15px] font-semibold leading-[1.3] text-[var(--mp-tx)] [overflow-wrap:anywhere]">
                    {idea.activity.title}
                  </p>
                  {ideaMeta(idea.activity) ? (
                    <p className="m-0 mt-0.5 truncate text-[13px] text-[var(--mp-tx2)]">{ideaMeta(idea.activity)}</p>
                  ) : null}
                </div>
              </div>
              <button
                type="button"
                disabled={addingActivityId === idea.activityId}
                onClick={() => void handleAddIdeaToPlan(idea)}
                className="mt-2.5 flex min-h-11 w-full items-center justify-center rounded-xl bg-[var(--mp-ac-dark)] px-3 text-[15px] font-bold text-white transition-colors hover:opacity-90 disabled:opacity-60"
              >
                <span className="truncate">Запланировать на {dayLabel}</span>
              </button>
            </div>
          );
        })}
      </section>
    );
  };

  /** Кнопка «Подобрать, куда сходить»: открывает экран подборки и, если её ещё нет, запрашивает её. */
  const renderIdeas = () => {
    if (isPendingDateHydration) return null;
    return (
      <button
        type="button"
        onClick={openPicks}
        className="group flex min-h-[76px] w-full items-center gap-3.5 rounded-[22px] border border-[var(--mp-line)] bg-[var(--mp-card)] py-3 pl-3.5 pr-4 text-left transition-colors hover:border-[var(--mp-tx)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        <span className="flex h-[50px] w-[50px] shrink-0 items-center justify-center rounded-full bg-[var(--mp-tx)] text-white">
          <Search className="h-5 w-5" strokeWidth={1.8} aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-semibold leading-[1.3] tracking-[-.01em] text-[var(--mp-tx)]">Подобрать, куда сходить</span>
          <span className="mt-[3px] block text-[13px] text-[var(--mp-tx2)]">Активности на {posterDayWord(selectedDate, todayKey)}</span>
        </span>
        <ArrowRight className="h-[18px] w-[18px] shrink-0 text-[var(--mp-tx2)] transition-transform group-hover:translate-x-[3px] group-hover:text-[var(--mp-ac-dark)]" strokeWidth={1.8} aria-hidden />
      </button>
    );
  };

  /** Запрос подборки с экрана подборки: свой возраст важнее состава, «Для всех» = возраст «Любой». */
  const refetchPicks = (ids: string[], ages: string[]) => {
    if (ages.length > 0) {
      void handleFetchSuggestions(createPlanSuggestionAudienceSnapshot(ages, ids));
      return;
    }
    if (ids.length === 0) {
      handleDecideClick();
      return;
    }
    const childIds = personas.filter((persona) => persona.kind === "child" && ids.includes(persona.id)).map((persona) => persona.id);
    const derived = childIds.length === 0 ? ["18+"] : deriveAgeRangesFromChildren(childrenList, childIds).map((item) => item.range);
    void handleFetchSuggestions(createPlanSuggestionAudienceSnapshot(derived, ids));
  };

  const handlePicksPeople = (id: string | null) => {
    const next = id === null ? [] : picksPeople.includes(id) ? picksPeople.filter((x) => x !== id) : [...picksPeople, id];
    setPicksPeople(next);
    if (id === null) setPicksAges([]);
    refetchPicks(next, id === null ? [] : picksAges);
  };

  const handlePicksAge = (value: string) => {
    const next = toggleAgeRangeSelection(picksAges, value);
    setPicksAges(next);
    refetchPicks(picksPeople, next);
  };

  const handlePicksResetAges = () => {
    setPicksAges([]);
    refetchPicks(picksPeople, []);
  };

  const renderBottomActions = () => (
    <div className="space-y-3">
      {scenarioCtaLabel ? (
        <BuildScenarioButton
          onClick={scenarioCtaState === "create" ? handleOpenScenarioPage : () => openNestedScreen("scenario")}
          label={scenarioCtaLabel}
          hint={
            scenarioCtaState === "create"
              ? "Соберем из добавленных событий красивый маршрут дня"
              : undefined
          }
        />
      ) : null}
      <div className="flex items-center gap-3.5 pt-2" aria-hidden>
        <i className="h-px flex-1 bg-[var(--mp-line-strong)]" />
        <span className="mp-font-display text-[18px] italic text-[var(--mp-tx2)]">или без даты</span>
        <i className="h-px flex-1 bg-[var(--mp-line-strong)]" />
      </div>
      <nav aria-label="Разделы моего плана">
        {ideasCount ? (
          <button
            type="button"
            onClick={handleOpenMyIdeas}
            className="group flex min-h-[76px] w-full items-center gap-3.5 rounded-[22px] border border-[var(--mp-line)] bg-[var(--mp-card)] py-3 pl-3.5 pr-4 text-left transition-colors hover:border-[var(--mp-tx)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <span className="flex h-[50px] w-[50px] shrink-0 items-center justify-center rounded-full border border-[var(--mp-line-strong)] bg-white text-[var(--mp-tx)]">
              <Heart className="h-[19px] w-[19px]" strokeWidth={1.8} aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[15px] font-semibold leading-[1.3] tracking-[-.01em] text-[var(--mp-tx)]">Мои идеи · {ideasCount}</span>
              <span className="mt-[3px] block text-[13px] text-[var(--mp-tx2)]">Поставьте на свободный день</span>
            </span>
            <ArrowRight className="h-[18px] w-[18px] shrink-0 text-[var(--mp-tx2)] transition-transform group-hover:translate-x-[3px] group-hover:text-[var(--mp-ac-dark)]" strokeWidth={1.8} aria-hidden />
          </button>
        ) : (
          <div className="flex min-h-[76px] w-full items-center gap-3.5 rounded-[22px] border border-[var(--mp-line)] bg-[var(--mp-card)] py-3 pl-3.5 pr-4">
            <span className="flex h-[50px] w-[50px] shrink-0 items-center justify-center rounded-full border border-[var(--mp-line-strong)] bg-white text-[var(--mp-tx)]">
              <Bookmark className="h-[19px] w-[19px]" strokeWidth={1.8} aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[15px] font-semibold leading-[1.3] tracking-[-.01em] text-[var(--mp-tx)]">Идей пока нет</span>
              <span className="mt-[3px] block text-[13px] text-[var(--mp-tx2)]">Сохраняйте места из афиши без даты</span>
            </span>
          </div>
        )}
        <button
          type="button"
          onClick={() => openNestedScreen("visits")}
          className="mx-auto mt-[22px] block min-h-11 px-3 text-center text-[13px] font-medium text-[var(--mp-tx2)] transition-colors hover:text-[var(--mp-tx)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          История визитов →
        </button>
      </nav>
    </div>
  );

  /** Заголовок недели и карточка оценки визита — верх экрана по макету v3. */
  const renderHead = () => (
    <>
      <p className="m-0 mb-[18px] text-[22px] font-bold leading-[1.15] tracking-[-.01em] text-[var(--mp-tx)] [text-wrap:pretty]">
        {currentWeekCount > 0 ? "Что у нас на неделе?" : "Неделя пока свободна"}
      </p>
      <PlanFeedbackCard key={`${experienceFeed?.awaitingFeedback[0]?.id ?? ""}-${experienceFeed?.pending[0]?.planItemId ?? ""}`} feed={experienceFeed} todayIso={todayKey} onChanged={() => void reloadExperienceFeed()} onOpenVisits={() => openNestedScreen("visits")} />
    </>
  );

  // Свои дела и записи Telegram используют одну форму даты/времени; каталог — расписание.
  const movingNote = movingItem?.source === "MANUAL" || movingItem?.source === "TELEGRAM_FORWARD"
    ? movingItem : null;
  if (movingNote) {
    return (
      <PlanNewTaskScreen
        todayIso={todayKey}
        initialDate={movingNote.date < todayKey ? todayKey : movingNote.date}
        editItem={movingNote}
        people={[
          ...(familyAdults.length ? familyAdults.map(adult => ({
            id: adult.userId,
            name: adult.isMe ? "Я" : adult.displayName?.trim() || "Взрослый",
            kind: "adult" as const,
          })) : personas.filter(persona => persona.kind === "adult").map(persona => ({
            id: persona.id,
            name: persona.displayName?.trim() || "Я",
            kind: "adult" as const,
          }))),
          ...personas.filter(persona => persona.kind === "child").map(persona => ({
            id: persona.id,
            name: persona.displayName?.trim() || "Ребёнок",
            kind: "child" as const,
          })),
        ]}
        onBack={() => setMovingItem(null)}
        onSaved={(date) => {
          setMovingItem(null);
          onChangeDate?.(date);
        }}
      />
    );
  }

  const planContent = isDesktop ? (
      <div className="relative flex h-full min-h-0 flex-col bg-[var(--mp-bg)]">
        <div className="sticky top-0 z-20 flex-shrink-0">
          <MyPlanHeader onClose={onRequestClose} tight />
        </div>

        <div
          id="my-plan-recommendations"
          className="min-h-0 flex-1 space-y-4 overflow-y-auto bg-[var(--mp-bg)] px-8 pb-28 pt-0"
        >
          {renderHead()}

          {planCalendar}

          {renderPersonFilter(false)}

          {isPastDay ? (
            renderPastDay(false)
          ) : (
            <>
              {renderDayList(false)}
              {renderOwnIdeas()}
              {renderIdeas()}
            </>
          )}
          {!isPastDay ? renderBottomActions() : null}
        </div>

        <PlanStickyCounter
          onAdd={isPastDay ? undefined : () => { setEditingNote(null); openNestedScreen("new"); }}
        />

        <PlanMoveSheet
        item={movingItem}
        onClose={() => setMovingItem(null)}
        onMoved={(date) => {
          setMovingItem(null);
          onChangeDate?.(date);
        }}
      />
      <AddPersonaTypeModal
          open={showAddPersonaTypeModal}
          onOpenChange={setShowAddPersonaTypeModal}
          onSelectChild={() => setShowAddChildModal(true)}
          layout="desktop"
        />

        <QuickAddChildModal
          open={showAddChildModal}
          onOpenChange={setShowAddChildModal}
          onSuccess={() => {
            toast.success("Ребёнок добавлен");
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
  ) : (
    <div className="relative flex h-full min-h-0 flex-col bg-[var(--mp-bg)]">
      <div className="flex-shrink-0">
        <MyPlanHeader onClose={onRequestClose} compact tight />
      </div>

      <div
        id="my-plan-recommendations"
        className="flex-1 space-y-5 overflow-y-auto bg-[var(--mp-bg)] px-5 pb-[calc(7rem+env(safe-area-inset-bottom))] pt-0"
      >
        {renderHead()}

        {planCalendar}

        {renderPersonFilter(true)}

        {isPastDay ? (
          renderPastDay(true)
        ) : (
          <>
            {renderDayList(true)}
            {renderOwnIdeas()}
            {renderIdeas()}
          </>
        )}
          {!isPastDay ? renderBottomActions() : null}
      </div>

      <PlanStickyCounter
        onAdd={isPastDay ? undefined : () => { setEditingNote(null); openNestedScreen("new"); }}
        compact
      />

      <PlanMoveSheet
        item={movingItem}
        onClose={() => setMovingItem(null)}
        onMoved={(date) => {
          setMovingItem(null);
          onChangeDate?.(date);
        }}
      />
      <AddPersonaTypeModal
        open={showAddPersonaTypeModal}
        onOpenChange={setShowAddPersonaTypeModal}
        onSelectChild={() => setShowAddChildModal(true)}
        layout="default"
      />

      <QuickAddChildModal
        open={showAddChildModal}
        onOpenChange={setShowAddChildModal}
        onSuccess={() => {
          toast.success("Ребёнок добавлен");
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

  return (
    <div
      className="relative flex min-h-0 flex-1 flex-col w-full overflow-hidden bg-[var(--mp-bg)]"
      // Страховка: обрезанную дорожку слайда нельзя прокрутить вручную или фокусом — только transform.
      onScroll={(event) => {
        if (event.currentTarget.scrollLeft !== 0) event.currentTarget.scrollLeft = 0;
      }}
    >
      <div
        className={cn(
          "flex min-h-0 flex-1 w-[200%] transform-gpu transition-transform duration-300 ease-in-out motion-reduce:transition-none",
          screen === "plan" ? "translate-x-0" : "-translate-x-1/2",
        )}
      >
        <div
          className="h-full min-h-0 w-1/2 shrink-0"
          aria-hidden={screen !== "plan"}
          inert={screen !== "plan"}
        >
          {planContent}
        </div>
        <div
          className="h-full min-h-0 w-1/2 shrink-0"
          aria-hidden={screen === "plan"}
          inert={screen === "plan"}
        >
          {mountedNestedScreen === "new" ? (
            <PlanNewTaskScreen
              key={nestedScreenVersion}
              todayIso={todayKey}
              initialDate={editingNote ? (editingNote.date < todayKey ? todayKey : editingNote.date) : selectedDate < todayKey ? todayKey : selectedDate}
              editItem={editingNote}
              people={[
          ...(familyAdults.length ? familyAdults.map(adult => ({
            id: adult.userId,
            name: adult.isMe ? "Я" : adult.displayName?.trim() || "Взрослый",
            kind: "adult" as const,
          })) : personas.filter(persona => persona.kind === "adult").map(persona => ({
            id: persona.id,
            name: persona.displayName?.trim() || "Я",
            kind: "adult" as const,
          }))),
          ...personas.filter(persona => persona.kind === "child").map(persona => ({
            id: persona.id,
            name: persona.displayName?.trim() || "Ребёнок",
            kind: "child" as const,
          })),
        ]}
              onBack={closeNestedScreen}
              onSaved={(date) => {
                onChangeDate?.(date);
                closeNestedScreen();
              }}
            />
          ) : mountedNestedScreen === "event" ? (
            openedEvent?.articleId ? (
              <PlanArticleScreen
                key={openedEvent.id}
                onNavigate={onRequestClose}
                item={openedEvent}
                onBack={closeNestedScreen}
                onRemove={() => {
                  handleRemoveFromPlan(openedEvent.id);
                  closeNestedScreen();
                }}
                onMove={canMovePlanItem(openedEvent) && !isPastDay ? () => setMovingItem(openedEvent) : undefined}
              />
            ) : openedEvent ? (
              <PlanEventScreen
                key={openedEvent.id}
                onNavigate={onRequestClose}
                item={openedEvent}
                onBack={closeNestedScreen}
                onRemove={() => {
                  handleRemoveFromPlan(openedEvent.id);
                  closeNestedScreen();
                }}
                onMove={canMovePlanItem(openedEvent) && !isPastDay ? () => setMovingItem(openedEvent) : undefined}
              />
            ) : null
          ) : mountedNestedScreen === "scenario" ? (
            <PlanScenarioScreen
              date={selectedDate}
              items={dayItems}
              changed={scenarioCtaState === "changed"}
              onBack={closeNestedScreen}
              onOpen={handleOpenScenarioPage}
            />
          ) : mountedNestedScreen === "visits" ? (
            <PlanVisitsScreen key={nestedScreenVersion} onBack={closeNestedScreen} />
          ) : mountedNestedScreen === "picks" ? (
            <PlanPicksScreen
              key={nestedScreenVersion}
              title={`Куда сходить ${(() => {
                if (selectedDate === todayKey) return "сегодня";
                if (selectedDate === addDaysIso(todayKey, 1)) return "завтра";
                const weekday = weekdayForNa(new Date(`${selectedDate}T12:00:00`));
                return `${weekday.startsWith("вторник") ? "во" : "в"} ${weekday}`;
              })()}`}
              meta={(() => {
                const date = new Date(`${selectedDate}T12:00:00`);
                const weekday = date.toLocaleDateString("ru-RU", { weekday: "long" });
                return `${weekday.charAt(0).toUpperCase()}${weekday.slice(1)}, ${date.toLocaleDateString("ru-RU", { day: "numeric", month: "long" })}`;
              })()}
              people={personas.map((persona) => ({
                id: persona.id,
                label: persona.kind === "adult" ? "Я" : persona.displayName?.trim() || "Ребёнок",
              }))}
              selectedPeopleIds={picksPeople}
              onTogglePerson={handlePicksPeople}
              ageOptions={AGE_GROUPS.filter((group) => group.value !== "18+").map((group) => ({ value: group.value, label: group.label }))}
              selectedAges={picksAges}
              onToggleAge={handlePicksAge}
              onResetAges={handlePicksResetAges}
              suggestions={suggestions}
              loading={isFetchingSuggestions}
              failed={suggestionsError}
              addingActivityId={addingActivityId}
              metaFor={ideaMeta}
              ageQuestion={
                awaitingAgeAnswer ? (
                  <PlanNeedsAgeQuestion
                    onConfirm={handleAgeAnswerConfirm}
                    onCancel={() => {
                      handleAgeAnswerCancel();
                      closeNestedScreen();
                    }}
                  />
                ) : null
              }
              exhausted={suggestionsGeneration >= MAX_SUGGESTION_BATCHES}
              onAdd={(activity) => void handleAddSuggestionToPlan(activity)}
              onRetry={() => void handleFetchSuggestions(lastRequestSnapshotRef.current)}
              onMore={handleRegenerate}
              onOpenCatalog={handleOpenCatalog}
              onBack={closeNestedScreen}
              onClose={onRequestClose}
            />
          ) : mountedNestedScreen === "month" ? (
            <PlanMonthScreen
              key={nestedScreenVersion}
              today={todayKey}
              selected={selectedDate}
              onBack={closeNestedScreen}
              onClose={onRequestClose}
              onOpenDay={(date) => {
                onChangeDate?.(date);
                closeNestedScreen();
              }}
              onAddOnDay={(date) => {
                onChangeDate?.(date);
                setEditingNote(null);
                openNestedScreen("new");
              }}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}
