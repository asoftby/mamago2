"use client";

import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Calendar, Plus } from "lucide-react";
import { ModalCloseButton } from "@/components/ui/modal-close-button";
import { RecommendationCard } from "./RecommendationCard";
import type { PlanItemWithActivity } from "../types/event";
import type { PlanSlot, PlanSlotType } from "../hooks/useMyPlan";
import { AGE_GROUPS } from "@/features/filters/age/ageGroups";
import type { MyPlanIdea } from "../hooks/useMyPlan";
import { useOptionalCity } from "@/contexts/CityContext";
import { useFamilyPersona } from "@/contexts/FamilyPersonaContext";
import { getCityLocativePhrase } from "@/lib/city/cityDisplayNames";
import type { AgeRangeSelection } from "@/features/filters/discovery/childrenScope.store";
import { toast } from "sonner";
import { WeekCalendarStrip } from "./WeekCalendarStrip";
import { publicActivityPath } from "@/lib/business/eventPublicLink";
import { QuickAddChildModal } from "@/components/children/QuickAddChildModal";
import { QuickAddAdultModal } from "@/components/adults/QuickAddAdultModal";
import { PlanAudienceCompact } from "./PlanAudienceCompact";
import { PlanAudienceSheet } from "./PlanAudienceSheet";
import { DayScenarioModal } from "./DayScenarioModal";
import { AddPersonaTypeModal } from "./AddPersonaTypeModal";
import { PlanOnboardingPromoBanner } from "./PlanOnboardingPromoBanner";
import { AddParticipantModal } from "@/components/children/AddParticipantModal";
import { PlanIdeasBlock } from "./PlanIdeasBlock";
import { PlanRecommendationsBlock } from "./PlanRecommendationsBlock";
import {
  isPlanSuggestionMockId,
  mergePlanSuggestionsWithMocks,
} from "../lib/mockPlanSuggestions";
import { sortPlanItemsForDay } from "../lib/sortPlanItemsForDay";

interface PlanChildChip {
  id: string;
  name: string;
  birthDate?: string;
}

interface PlanMainContentProps {
  planSlots: PlanSlot[]; // Deprecated: kept for backward compatibility
  selectedDate: string;
  onChangeDate?: (date: string) => void;
  weekDates?: string[];
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
  autoAgeValues: string[];
  // Deprecated: slot-based functions kept for backward compatibility
  onCycleSlotAlternative?: (periodId: PlanSlotType) => void;
  onCycleSlotAlternativePrev?: (periodId: PlanSlotType) => void;
  onMarkSlotSaved?: (slot: PlanSlotType, item: PlanItemWithActivity) => void;
  onClearSlotSaved?: (slot: PlanSlotType, itemId: string) => void;
  onOpenSlotSuggestion?: (slot: PlanSlotType) => void;
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

function ageLabel(birthDate?: string): string {
  if (!birthDate) return "";
  const b = new Date(birthDate);
  if (Number.isNaN(b.getTime())) return "";
  const now = new Date();
  let y = now.getFullYear() - b.getFullYear();
  const m = now.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < b.getDate())) y -= 1;
  if (y < 0) return "";
  return `${y} лет`;
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

function ageToGroupValue(years: number): string | null {
  const group = AGE_GROUPS.find((g) => years >= g.min && (g.max == null || years <= g.max));
  return group?.value ?? null;
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

const RECOMMENDATIONS_BLOCK_SUBTITLE =
  "Подобрано на основании ваших интересов и предпочтений";

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
  planSlots,
  selectedDate,
  onChangeDate,
  weekDates,
  planItemsByDate,
  todayIso,
  layout = "default",
  onAddItemToPlan,
  onRemoveItemFromPlan,
  childrenList,
  selectedChildIds,
  onChangeSelectedChildIds,
  selectedAgeRanges,
  onChangeSelectedAgeRanges,
  autoAgeValues,
  onCycleSlotAlternative,
  onCycleSlotAlternativePrev,
  onMarkSlotSaved,
  onClearSlotSaved,
  onOpenSlotSuggestion,
  ideas = [],
  ideasLoading = false,
  onAddIdeaToPlan,
  onRemoveIdea,
  planSuggestions = [],
  suggestionsLoading = false,
  onAddSuggestionToPlan,
  onRequestClose,
}: PlanMainContentProps) {
  const params = useParams() as { city?: string };
  const pathname = usePathname();
  const router = useRouter();
  const currentSearchParams = useSearchParams();
  const cityCtx = useOptionalCity();
  const city = cityCtx?.citySlug ?? params?.city ?? "minsk";
  const family = useFamilyPersona();
  const primaryAdultPersonaId = family?.primaryAdultPersonaId ?? null;
  const adultSelected =
    !!primaryAdultPersonaId &&
    !!family?.selectedPersonaIds.includes(primaryAdultPersonaId);
  const isDesktop = layout === "desktop";
  const [removingIdeaActivityId, setRemovingIdeaActivityId] = useState<string | null>(null);
  const [addingActivityId, setAddingActivityId] = useState<string | null>(null);
  const [showAddChildModal, setShowAddChildModal] = useState(false);
  const [showAddAdultModal, setShowAddAdultModal] = useState(false);
  const [showAddPersonaTypeModal, setShowAddPersonaTypeModal] = useState(false);
  const [childPromoDismissed, setChildPromoDismissed] = useState(false);
  const [adultPromoDismissed, setAdultPromoDismissed] = useState(false);
  const [showAdultParticipantModal, setShowAdultParticipantModal] = useState(false);
  const [showAudienceSheet, setShowAudienceSheet] = useState(false);
  const [showDayScenario, setShowDayScenario] = useState(false);

  const handleAddToPlan = (item: PlanItemWithActivity) => {
    onAddItemToPlan?.(item);
  };

  const handleRemoveFromPlan = async (itemId: string) => {
    if (!onRemoveItemFromPlan) return;
    try {
      const result = onRemoveItemFromPlan(itemId);
      const ok = result instanceof Promise ? await result : true;
      if (!ok) toast.error("Не удалось убрать из плана");
    } catch {
      toast.error("Не удалось убрать из плана");
    }
  };

  const handleShowMoreAlternatives = () => {
    // Deprecated: no more slot-based alternatives
  };

  const handleShowPrevAlternative = () => {
    // Deprecated: no more slot-based alternatives
  };

  const dateObj = new Date(selectedDate + "T12:00:00");

  // Персоны для audience selector (must be declared before use)
  const personas = useMemo(() => {
    if (!family?.personas) return [];
    return family.personas;
  }, [family?.personas]);

  /** Дети из профиля в плане могут отставать от FamilyPersonaContext после QuickAddChildModal */
  const hasChildren = useMemo(() => {
    if (childrenList.length > 0) return true;
    return personas.some((p) => p.kind === "child");
  }, [childrenList.length, personas]);

  const primaryAdultPersona = useMemo(
    () => personas.find((p) => p.kind === "adult"),
    [personas],
  );
  const adultProfileComplete = primaryAdultPersona?.isProfileComplete === true;

  /**
   * Один последовательный шаг: ребёнок → профиль взрослого → скрыто.
   * Нет детей: всегда баннер про ребёнка (даже если имя взрослого не задано).
   */
  const promoStep = useMemo<"child" | "adult" | null>(() => {
    if (!hasChildren) return "child";
    if (!adultProfileComplete) return "adult";
    return null;
  }, [hasChildren, adultProfileComplete]);

  const showChildPromo = promoStep === "child" && !childPromoDismissed;
  const showAdultPromo = promoStep === "adult" && !adultPromoDismissed;

  const handleAdultPromoPrimary = useCallback(() => {
    onRequestClose?.();
    window.setTimeout(() => setShowAdultParticipantModal(true), 0);
  }, [onRequestClose]);

  /**
   * Полный список выбранных персон (взрослые + дети) из FamilyPersonaContext
   */
  const selectedPersonaIds = useMemo(() => {
    if (!family?.selectedPersonaIds) return [];
    return family.selectedPersonaIds;
  }, [family?.selectedPersonaIds]);

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
  const handleTogglePersona = (personaId: string) => {
    const isSelected = selectedPersonaIds.includes(personaId);
    
    if (isSelected) {
      // Deselect persona
      const newIds = selectedPersonaIds.filter((id) => id !== personaId);
      
      // Update via FamilyPersonaContext (single source of truth)
      if (family?.setSelectedPersonaIds) {
        family.setSelectedPersonaIds(newIds);
      }
      
      // If no personas left, automatically enters free search mode
      if (newIds.length === 0) {
        onChangeSelectedAgeRanges([]);
      }
    } else {
      // Select persona (exits free search mode automatically)
      const newIds = [...selectedPersonaIds, personaId];
      
      // Update via FamilyPersonaContext (single source of truth)
      if (family?.setSelectedPersonaIds) {
        family.setSelectedPersonaIds(newIds);
      }
    }
  };

  /**
   * Toggle free search mode - clears all persona selections
   */
  const handleToggleFreeMode = () => {
    // Switch to free mode: clear all selections via FamilyPersonaContext
    if (family?.setSelectedPersonaIds) {
      family.setSelectedPersonaIds([]);
    }
    onChangeSelectedAgeRanges([]);
  };

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
    if (selectedChildIds.length === 0 || selectedChildIds.length === childrenList.length) {
      qp.set("children", "all");
    } else {
      qp.set("children", selectedChildIds.join(","));
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
    if (isPlanSuggestionMockId(activity.id)) {
      onRequestClose?.();
      window.setTimeout(() => {
        router.push(buildFindAndAddHref());
      }, 0);
      return;
    }
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
          toast.error("Не удалось добавить в план");
        } else {
          toast.success("Добавлено в план");
        }
      } catch {
        toast.error("Не удалось добавить в план");
      } finally {
        setAddingActivityId(null);
      }
    },
    [onAddIdeaToPlan, planItemsByDate, selectedDate],
  );

  const handleAddSuggestionToPlan = useCallback(
    async (activity: NonNullable<MyPlanIdea["activity"]>) => {
      if (isPlanSuggestionMockId(activity.id)) {
        toast.info(
          "Это пример из подборки — выберите событие в каталоге ниже или по кнопке «Добавить ещё».",
        );
        return;
      }
      if (
        (planItemsByDate?.[selectedDate] ?? []).some(
          (i) => i.activityId === activity.id,
        )
      ) {
        return;
      }
      if (!onAddSuggestionToPlan) return;
      setAddingActivityId(activity.id);
      try {
        const result = await onAddSuggestionToPlan(activity);
        if (!result.ok) {
          toast.error("Не удалось добавить в план");
        } else {
          requestAnimationFrame(() => {
            document.getElementById("my-plan-recommendations")?.scrollTo({
              top: 0,
              behavior: "smooth",
            });
          });
        }
      } catch {
        toast.error("Не удалось добавить в план");
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

  const dayItems = planItemsByDate?.[selectedDate] ?? [];

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

  const totalPlannedCount = useMemo(
    () => dayItems.length,
    [dayItems],
  );

  /** «Сценарий дня» — когда в дне больше двух событий (три и более). */
  const canOpenDayScenario = useMemo(() => {
    return totalPlannedCount > 2;
  }, [totalPlannedCount]);

  const dayEmpty = dayItems.length === 0;
  const hasSavedIdeas = ideas.length > 0;
  /** Пустой день: идеи + плейсхолдер загрузки */
  const showIdeasOnEmptyDay = dayEmpty && (hasSavedIdeas || ideasLoading);

  const planSuggestionsForBlock = useMemo(
    () => mergePlanSuggestionsWithMocks(planSuggestions, 5),
    [planSuggestions],
  );

  const todayKey = todayIso ?? new Date().toISOString().split("T")[0];

  const planHeaderTitle = useMemo(
    () => formatPlanHeaderTitle(selectedDate, todayKey),
    [selectedDate, todayKey],
  );

  const planHeaderSubtitle = useMemo(
    () =>
      buildPlanHeaderSubtitle(
        selectedPersonaIds,
        personas,
        isFreeSearchMode,
        city,
      ),
    [selectedPersonaIds, personas, isFreeSearchMode, city],
  );

  const recommendationsSectionHeading = useMemo(
    () =>
      buildRecommendationsSectionHeading(
        selectedPersonaIds,
        personas,
        isFreeSearchMode,
        selectedDate,
        todayKey,
      ),
    [selectedPersonaIds, personas, isFreeSearchMode, selectedDate, todayKey],
  );

  const catalogCtaHint =
    "Откроем каталог «Куда пойти» с этой датой и с учётом участников, выбранных выше.";

  if (isDesktop) {
    return (
      <div className="flex h-full min-h-0 flex-col bg-neutral-50">
        <div className="sticky top-0 z-20 flex-shrink-0 space-y-3 bg-neutral-50 px-8 pb-2 pt-6">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 space-y-0.5 pr-2">
              <h2 className="text-2xl font-bold tracking-tight text-neutral-900">
                {planHeaderTitle}
              </h2>
              <p className="mb-0 min-h-[2.25rem] max-w-2xl text-sm leading-snug text-neutral-600 line-clamp-2">
                {planHeaderSubtitle}
              </p>
            </div>
            <ModalCloseButton
              type="button"
              onClick={() => onRequestClose?.()}
              className="shrink-0"
              aria-label="Закрыть мой план"
            />
          </div>

          {onChangeDate ? (
            <WeekCalendarStrip
              selectedDate={selectedDate}
              onChangeDate={onChangeDate}
              showArrows
            />
          ) : null}

        </div>

        <div
          id="my-plan-recommendations"
          className="min-h-0 flex-1 space-y-3 overflow-y-auto scroll-mt-4 bg-white px-8 pb-1.5 pt-1"
        >
          {/* Компактный блок аудитории */}
          <PlanAudienceCompact
            selectedPersonaIds={selectedPersonaIds}
            personas={personas}
            audienceMode={audienceMode}
            onTogglePersona={handleTogglePersona}
            onToggleFreeMode={handleToggleFreeMode}
            onAddClick={() => setShowAddPersonaTypeModal(true)}
          />

          {showChildPromo ? (
            <PlanOnboardingPromoBanner
              variant="child"
              onPrimary={() => setShowAddChildModal(true)}
              onSecondary={() => setChildPromoDismissed(true)}
            />
          ) : showAdultPromo ? (
            <PlanOnboardingPromoBanner
              variant="adult"
              onPrimary={handleAdultPromoPrimary}
              onSecondary={() => setAdultPromoDismissed(true)}
            />
          ) : null}

          <div className="space-y-4">
            {dayEmpty ? (
              <div className="flex flex-row items-start gap-4 rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
                <Calendar className="h-10 w-10 shrink-0 text-neutral-400" strokeWidth={1.25} />
                <div className="min-w-0">
                  <h3 className="font-semibold text-neutral-900">День пока пустой</h3>
                  <p className="mt-1 text-sm leading-relaxed text-neutral-500">
                    Добавьте событие из каталога либо выберите вариант в блоках ниже.
                  </p>
                </div>
              </div>
            ) : null}

            {!dayEmpty ? (
              <div className="space-y-3">
                {dayItemsSorted.map((planItem) => (
                  <div key={planItem.id} className="animate-mg-plan-day-item-in">
                    <RecommendationCard
                      item={planItem}
                      isInPlan
                      onRemoveFromPlan={() =>
                        handleRemoveFromPlan(planItem.id)
                      }
                    />
                  </div>
                ))}
                <Link
                  href={buildFindAndAddHref()}
                  className="flex w-full items-center justify-center gap-2 rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm font-semibold text-neutral-900 shadow-sm transition-colors hover:bg-neutral-50"
                  onClick={(event) => handleFindAndAddClick(event)}
                >
                  <Plus className="h-4 w-4 shrink-0" strokeWidth={2} />
                  Добавить ещё
                </Link>
                <p className="text-center text-[11px] text-neutral-500 sm:text-xs">
                  {catalogCtaHint}
                </p>
              </div>
            ) : null}

            {showIdeasOnEmptyDay ? (
              <PlanIdeasBlock
                ideas={ideas}
                city={city}
                loading={ideasLoading && !hasSavedIdeas}
                addingActivityId={addingActivityId}
                removingActivityId={removingIdeaActivityId}
                onAddToPlan={handleAddIdeaToPlan}
                onRemoveIdea={handleRemoveIdea}
                onOpenActivity={handleIdeaOpenClick}
                onAllIdeasClick={handleIdeasPageClick}
              />
            ) : null}

            <PlanRecommendationsBlock
              heading={recommendationsSectionHeading}
              subtitle={RECOMMENDATIONS_BLOCK_SUBTITLE}
              activities={planSuggestionsForBlock}
              city={city}
              loading={suggestionsLoading}
              addingActivityId={addingActivityId}
              inPlanActivityIds={inPlanActivityIds}
              onAddToPlan={handleAddSuggestionToPlan}
              onOpenActivity={handleIdeaOpenClick}
              seeMoreHref={buildFindAndAddHref()}
            />

            {dayEmpty ? (
              <div className="rounded-2xl border border-neutral-200 bg-neutral-50/90 p-1.5">
                <Link
                  href={buildFindAndAddHref()}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-neutral-900 px-4 py-3.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-neutral-800"
                  onClick={(event) => handleFindAndAddClick(event)}
                >
                  <Plus className="h-4 w-4 shrink-0" strokeWidth={2} />
                  Добавить событие
                </Link>
                <p className="px-2 pb-1 pt-2.5 text-center text-[11px] leading-snug text-neutral-500 sm:text-xs">
                  {catalogCtaHint}
                </p>
              </div>
            ) : null}

            {hasSavedIdeas && !dayEmpty ? (
              <PlanIdeasBlock
                ideas={ideas}
                city={city}
                addingActivityId={addingActivityId}
                removingActivityId={removingIdeaActivityId}
                onAddToPlan={handleAddIdeaToPlan}
                onRemoveIdea={handleRemoveIdea}
                onOpenActivity={handleIdeaOpenClick}
                onAllIdeasClick={handleIdeasPageClick}
              />
            ) : null}
          </div>
        </div>

        {canOpenDayScenario ? (
          <div className="flex-shrink-0 space-y-3 border-t border-neutral-200 bg-white px-8 py-5">
            <Button
              onClick={() => setShowDayScenario(true)}
              className="h-12 w-full bg-neutral-900 text-base font-semibold hover:bg-neutral-800"
            >
              Сценарий дня
            </Button>
            <p className="text-center text-xs text-neutral-500">
              Откройте красивый таймлайн собранного дня
            </p>
          </div>
        ) : null}

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

        <PlanAudienceSheet
          open={showAudienceSheet}
          onOpenChange={setShowAudienceSheet}
          personas={personas}
          selectedPersonaIds={selectedPersonaIds}
          onSelectionChange={(ids) => {
            if (family?.setSelectedPersonaIds) {
              family.setSelectedPersonaIds(ids);
            }
          }}
          layout="desktop"
        />

        <DayScenarioModal
          open={showDayScenario}
          onOpenChange={setShowDayScenario}
          date={selectedDate}
          city={city}
          audienceLabel={selectedChildrenLabel}
          items={dayItemsSorted}
          layout="desktop"
        />
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-neutral-50">
      <div className="flex-shrink-0 border-b border-neutral-200 bg-white/95 px-4 pb-3 pt-6 backdrop-blur supports-[backdrop-filter]:bg-white/85">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 pr-1">
            <h2 className="text-lg font-semibold leading-snug text-neutral-900">
              {planHeaderTitle}
            </h2>
            <p className="mb-0 mt-1 min-h-[2.25rem] text-sm leading-snug text-neutral-600 line-clamp-2">
              {planHeaderSubtitle}
            </p>
          </div>
          <ModalCloseButton
            type="button"
            onClick={() => onRequestClose?.()}
            className="shrink-0"
            aria-label="Закрыть мой план"
          />
        </div>
      </div>

      <div
        id="my-plan-recommendations"
        className="flex-1 space-y-3 overflow-y-auto scroll-mt-4 bg-white px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-3"
      >
        {/* Календарь */}
        {onChangeDate ? (
          <div className="pb-1">
            <WeekCalendarStrip
              selectedDate={selectedDate}
              onChangeDate={onChangeDate}
              compact
            />
          </div>
        ) : null}

        {/* Компактный блок аудитории */}
        <PlanAudienceCompact
          selectedPersonaIds={selectedPersonaIds}
          personas={personas}
          audienceMode={audienceMode}
          onTogglePersona={handleTogglePersona}
          onToggleFreeMode={handleToggleFreeMode}
          onAddClick={() => setShowAddPersonaTypeModal(true)}
          compact
        />

        {showChildPromo ? (
          <PlanOnboardingPromoBanner
            variant="child"
            onPrimary={() => setShowAddChildModal(true)}
            onSecondary={() => setChildPromoDismissed(true)}
          />
        ) : showAdultPromo ? (
          <PlanOnboardingPromoBanner
            variant="adult"
            onPrimary={handleAdultPromoPrimary}
            onSecondary={() => setAdultPromoDismissed(true)}
          />
        ) : null}

        {dayEmpty ? (
          <div className="flex flex-row items-start gap-3 rounded-2xl border border-neutral-200 bg-neutral-50/80 p-4">
            <Calendar className="h-9 w-9 shrink-0 text-neutral-400" strokeWidth={1.25} />
            <div className="min-w-0">
              <h3 className="font-semibold text-neutral-900">День пока пустой</h3>
              <p className="mt-1 text-sm leading-relaxed text-neutral-500">
                Добавьте событие из каталога либо выберите вариант в блоках ниже.
              </p>
            </div>
          </div>
        ) : null}

        {!dayEmpty ? (
          <div className="space-y-3">
            {dayItemsSorted.map((planItem) => (
              <div key={planItem.id} className="animate-mg-plan-day-item-in">
                <RecommendationCard
                  item={planItem}
                  isInPlan
                  onRemoveFromPlan={() =>
                    handleRemoveFromPlan(planItem.id)
                  }
                />
              </div>
            ))}
            <Link
              href={buildFindAndAddHref()}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm font-semibold text-neutral-900 shadow-sm transition-colors hover:bg-neutral-50"
              onClick={(event) => handleFindAndAddClick(event)}
            >
              <Plus className="h-4 w-4 shrink-0" strokeWidth={2} />
              Добавить ещё
            </Link>
            <p className="text-center text-[11px] text-neutral-500">{catalogCtaHint}</p>
          </div>
        ) : null}

        {showIdeasOnEmptyDay ? (
          <PlanIdeasBlock
            ideas={ideas}
            city={city}
            compact
            loading={ideasLoading && !hasSavedIdeas}
            addingActivityId={addingActivityId}
            removingActivityId={removingIdeaActivityId}
            onAddToPlan={handleAddIdeaToPlan}
            onRemoveIdea={handleRemoveIdea}
            onOpenActivity={handleIdeaOpenClick}
            onAllIdeasClick={handleIdeasPageClick}
          />
        ) : null}

        <PlanRecommendationsBlock
          heading={recommendationsSectionHeading}
          subtitle={RECOMMENDATIONS_BLOCK_SUBTITLE}
          activities={planSuggestionsForBlock}
          city={city}
          loading={suggestionsLoading}
          compact
          addingActivityId={addingActivityId}
          inPlanActivityIds={inPlanActivityIds}
          onAddToPlan={handleAddSuggestionToPlan}
          onOpenActivity={handleIdeaOpenClick}
          seeMoreHref={buildFindAndAddHref()}
        />

        {dayEmpty ? (
          <div className="rounded-2xl border border-neutral-200 bg-neutral-50/90 p-1.5">
            <Link
              href={buildFindAndAddHref()}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-neutral-900 px-4 py-3.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-neutral-800"
              onClick={(event) => handleFindAndAddClick(event)}
            >
              <Plus className="h-4 w-4 shrink-0" strokeWidth={2} />
              Добавить событие
            </Link>
            <p className="px-2 pb-1 pt-2.5 text-center text-[11px] leading-snug text-neutral-500">
              {catalogCtaHint}
            </p>
          </div>
        ) : null}

        {hasSavedIdeas && !dayEmpty ? (
          <PlanIdeasBlock
            ideas={ideas}
            city={city}
            compact
            addingActivityId={addingActivityId}
            removingActivityId={removingIdeaActivityId}
            onAddToPlan={handleAddIdeaToPlan}
            onRemoveIdea={handleRemoveIdea}
            onOpenActivity={handleIdeaOpenClick}
            onAllIdeasClick={handleIdeasPageClick}
          />
        ) : null}
      </div>

      {canOpenDayScenario ? (
        <div className="flex-shrink-0 space-y-3 border-t bg-white px-6 py-4">
          <Button
            onClick={() => setShowDayScenario(true)}
            className="h-12 w-full bg-gray-900 text-base font-semibold hover:bg-gray-800"
          >
            Сценарий дня
          </Button>
          <p className="text-center text-xs text-gray-500">
            Откройте красивый таймлайн собранного дня
          </p>
        </div>
      ) : null}

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

      <PlanAudienceSheet
        open={showAudienceSheet}
        onOpenChange={setShowAudienceSheet}
        personas={personas}
        selectedPersonaIds={selectedPersonaIds}
        onSelectionChange={(ids) => {
          if (family?.setSelectedPersonaIds) {
            family.setSelectedPersonaIds(ids);
          }
        }}
        layout="default"
      />

      <DayScenarioModal
        open={showDayScenario}
        onOpenChange={setShowDayScenario}
        date={selectedDate}
        city={city}
        audienceLabel={selectedChildrenLabel}
        items={dayItemsSorted}
        layout="default"
      />
    </div>
  );
}
