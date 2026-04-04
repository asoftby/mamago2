"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  type ReactNode,
} from "react";
import { useParams } from "next/navigation";
import { useOptionalCity } from "@/contexts/CityContext";
import { useFamilyPersona } from "@/contexts/FamilyPersonaContext";
import { useDiscoveryFilters } from "@/features/filters/discovery/filters.store";
import { useDiscoveryFilterOptions } from "@/features/filters/discovery/filters.api";
import { useChildrenScope } from "@/features/filters/discovery/childrenScope.store";

function todayISO(): string {
  return new Date().toISOString().split("T")[0];
}
import { useAuthMe } from "@/features/birthday/builder/hooks/useAuthMe";
import type { PlanItemWithActivity } from "../types/event";
import {
  countSelectableCandidatesForSlot,
  getCandidatesForSlot,
  MAX_PLAN_ITEMS_PER_SLOT,
  pickItemForSlot,
  pickItemForSlotExcluding,
  RECOMMENDATION_POOL,
  type PlanSlotType,
} from "../lib/recommendationPool";

export type { PlanSlotType };

export type PlanAccessPhase = "loading" | "no_children" | "ready";

export interface PlanSlot {
  type: PlanSlotType;
  /** Уже в плане (до MAX_PLAN_ITEMS_PER_SLOT на слот) */
  plannedItems: PlanItemWithActivity[];
  /** Текущая рекомендация: пустой слот или после «Добавить ещё» */
  suggestionItem: PlanItemWithActivity | null;
  /** Сколько вариантов для «Ещё варианты» у видимой рекомендации */
  alternativesCountForSuggestion: number;
  /** Есть ли ещё кандидаты в слоте после уже добавленных (для кнопки «Добавить ещё») */
  hasMoreCandidatesForAdd: boolean;
  /** Текущая позиция варианта рекомендации (1-based) */
  suggestionVariantPosition: number;
  /** Всего вариантов рекомендации для текущего слота */
  suggestionVariantTotal: number;
}

export interface ProfileChild {
  id: string;
  name: string;
  birthDate: string;
  systemInterests: string[];
}

/** Локальный черновик онбординга (месяц/год), не путать с API `ProfileChild`. */
export interface OnboardingChild {
  id: string;
  name: string;
  birthMonth: number;
  birthYear: number;
}

export interface MyPlanIdea {
  id: string;
  activityId: string;
  createdAt: string;
  inPlanOnDate: boolean;
  activity: NonNullable<PlanItemWithActivity["activity"]>;
}

const MyPlanStateContext = createContext<ReturnType<typeof useMyPlanStore> | null>(null);

export function MyPlanStateProvider({ children }: { children: ReactNode }) {
  const value = useMyPlanStore();
  return (
    <MyPlanStateContext.Provider value={value}>{children}</MyPlanStateContext.Provider>
  );
}

export function useMyPlan() {
  const ctx = useContext(MyPlanStateContext);
  if (!ctx) {
    throw new Error("useMyPlan must be used within MyPlanStateProvider");
  }
  return ctx;
}

const SLOT_TYPES: PlanSlotType[] = ["morning", "afternoon", "evening"];

function useMyPlanStore() {
  const params = useParams() as { city?: string };
  const cityCtx = useOptionalCity();
  const citySlug = cityCtx?.citySlug ?? params?.city ?? "minsk";
  const { applied: locationApplied, actions: discoveryActions } = useDiscoveryFilters();
  const { options: locationOptions } = useDiscoveryFilterOptions(citySlug);
  const { isAuthenticated, isLoading: authLoading } = useAuthMe();
  const family = useFamilyPersona();

  const [children, setChildren] = useState<ProfileChild[]>([]);
  const [profileLoading, setProfileLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPlanDate, setSelectedPlanDate] = useState<string>(todayISO);
  const [submittingChild, setSubmittingChild] = useState(false);
  const [slotAlternativeCursor, setSlotAlternativeCursor] = useState<
    Record<PlanSlotType, number>
  >({
    morning: 0,
    afternoon: 0,
    evening: 0,
  });

  /** По дате и слоту: события в плане (до MAX на слот) */
  const [slotPlanItemsByDate, setSlotPlanItemsByDate] = useState<
    Record<string, Partial<Record<PlanSlotType, PlanItemWithActivity[]>>>
  >({});
  /** После «Добавить ещё» — показать ещё одну рекомендацию (при непустом слоте) */
  const [slotPendingSuggestionByDate, setSlotPendingSuggestionByDate] = useState<
    Record<string, Partial<Record<PlanSlotType, boolean>>>
  >({});
  const [ideas, setIdeas] = useState<MyPlanIdea[]>([]);
  const [ideasLoading, setIdeasLoading] = useState(false);

  const childrenFamilySync = useMemo(
    () =>
      isAuthenticated && family
        ? {
            loading: family.loading,
            selectedPersonaIds: family.selectedPersonaIds,
            primaryAdultPersonaId: family.primaryAdultPersonaId,
            setSelectedPersonaIds: family.setSelectedPersonaIds,
          }
        : undefined,
    [
      isAuthenticated,
      family,
      family?.loading,
      family?.selectedPersonaIds,
      family?.primaryAdultPersonaId,
      family?.setSelectedPersonaIds,
    ],
  );

  const childrenScope = useChildrenScope({
    citySlug,
    availableChildren: children.map((c) => ({
      id: c.id,
      name: c.name,
      birthDate: c.birthDate,
    })),
    appliedAgeRanges: locationApplied.age ?? [],
    setAppliedAgeRanges: (nextAge) => {
      discoveryActions.setDraft({ age: nextAge });
    },
    familySync: childrenFamilySync,
  });
  const selectedChildrenIds = childrenScope.selectedChildrenIds;
  const selectedChildrenKey = useMemo(
    () => selectedChildrenIds.slice().sort().join(","),
    [selectedChildrenIds],
  );
  const scopeForRecommendations =
    selectedChildrenIds.length === children.length ? "all" : selectedChildrenIds;

  const refetchChildren = useCallback(async (): Promise<ProfileChild[]> => {
    if (!isAuthenticated) {
      setChildren([]);
      return [];
    }
    setProfileLoading(true);
    try {
      const res = await fetch("/api/children", { credentials: "include" });
      if (!res.ok) {
        setChildren([]);
        return [];
      }
      const data = (await res.json()) as {
        children?: Array<{
          id: string;
          name: string;
          birthDate: string;
          systemInterests?: Array<{ interestSlug: string }>;
        }>;
      };
      const raw = Array.isArray(data.children) ? data.children : [];
      const list: ProfileChild[] = raw.map((c) => ({
        id: c.id,
        name: c.name,
        birthDate:
          typeof c.birthDate === "string"
            ? c.birthDate
            : new Date(c.birthDate as unknown as string).toISOString(),
        systemInterests: Array.isArray(c.systemInterests)
          ? c.systemInterests.map((x) => x.interestSlug)
          : [],
      }));
      setChildren(list);
      return list;
    } catch {
      setChildren([]);
      return [];
    } finally {
      setProfileLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated || authLoading) {
      setChildren([]);
      return;
    }
    void refetchChildren();
  }, [isAuthenticated, authLoading, refetchChildren]);

  const refetchIdeas = useCallback(async (): Promise<MyPlanIdea[]> => {
    if (!isAuthenticated) {
      setIdeas([]);
      return [];
    }
    setIdeasLoading(true);
    try {
      const res = await fetch(`/api/save/ideas?date=${selectedPlanDate}`, {
        credentials: "include",
      });
      if (!res.ok) {
        setIdeas([]);
        return [];
      }
      const data = (await res.json()) as { ideas?: MyPlanIdea[] };
      const list = Array.isArray(data.ideas) ? data.ideas : [];
      setIdeas(list);
      return list;
    } catch {
      setIdeas([]);
      return [];
    } finally {
      setIdeasLoading(false);
    }
  }, [isAuthenticated, selectedPlanDate]);

  useEffect(() => {
    if (!isAuthenticated || authLoading) {
      setIdeas([]);
      return;
    }
    void refetchIdeas();
  }, [isAuthenticated, authLoading, refetchIdeas]);

  const accessPhase: PlanAccessPhase = useMemo(() => {
    if (authLoading) return "loading";
    if (!isAuthenticated) return "no_children";
    if (profileLoading) return "loading";
    if (children.length === 0) return "no_children";
    return "ready";
  }, [isAuthenticated, authLoading, profileLoading, children.length]);

  const locationFilteredPlanItems = useMemo(() => {
    const normalized = (v?: string | null) => (v ?? "").trim().toLowerCase();
    const cityNameBySlug: Record<string, string> = {
      minsk: "минск",
      brest: "брест",
      gomel: "гомель",
      grodno: "гродно",
      mogilev: "могилёв",
      vitebsk: "витебск",
    };
    const targetCity = cityNameBySlug[citySlug] ?? citySlug.toLowerCase();
    const metroLabel = locationApplied.metro
      ? normalized(
          locationOptions.metros.find((m) => m.value === locationApplied.metro)?.label ??
            locationApplied.metro,
        )
      : "";
    const districtLabel = locationApplied.district
      ? normalized(
          locationOptions.districts.find((d) => d.value === locationApplied.district)?.label ??
            locationApplied.district,
        )
      : "";

    return RECOMMENDATION_POOL.filter((candidate) => {
      const item = candidate.buildForDate(selectedPlanDate);
      const place = item.activity?.place;
      const city = normalized(place?.city?.name ?? "");
      if (city && targetCity && !city.includes(targetCity)) return false;

      const address = normalized(
        [place?.shortAddress, place?.formattedAddr, place?.customAddress]
          .filter(Boolean)
          .join(" "),
      );

      if (metroLabel && !address.includes(metroLabel)) return false;
      if (districtLabel && !address.includes(districtLabel)) return false;

      // nearby is part of shared state; demo recommendations do not have coordinates,
      // so we keep list stable and only apply city/metro/district filters.
      return true;
    });
  }, [
    citySlug,
    locationApplied.district,
    locationApplied.metro,
    locationOptions.districts,
    locationOptions.metros,
    selectedPlanDate,
  ]);

  const planItems = useMemo(() => {
    if (accessPhase !== "ready") return [];
    return locationFilteredPlanItems.map((c) => c.buildForDate(selectedPlanDate));
  }, [accessPhase, locationFilteredPlanItems, selectedPlanDate]);

  const planSlots = useMemo((): PlanSlot[] => {
    if (accessPhase !== "ready") return [];
    const kidsForRec = children.map((c) => ({
      id: c.id,
      birthDate: c.birthDate,
      systemInterests: c.systemInterests,
    }));
    return SLOT_TYPES.map((type) => {
      const plannedItems = slotPlanItemsByDate[selectedPlanDate]?.[type] ?? [];
      const pending = slotPendingSuggestionByDate[selectedPlanDate]?.[type] ?? false;
      const cursor = slotAlternativeCursor[type] ?? 0;

      let suggestionItem: PlanItemWithActivity | null = null;
      if (plannedItems.length === 0) {
        suggestionItem = pickItemForSlot(
          type,
          kidsForRec,
          scopeForRecommendations,
          cursor,
          selectedPlanDate,
          locationFilteredPlanItems,
        );
      } else if (plannedItems.length < MAX_PLAN_ITEMS_PER_SLOT && pending) {
        const excludeIds = plannedItems
          .map((i) => i.activityId)
          .filter((id): id is string => id != null && id !== "");
        suggestionItem = pickItemForSlotExcluding(
          type,
          kidsForRec,
          scopeForRecommendations,
          cursor,
          selectedPlanDate,
          excludeIds,
          locationFilteredPlanItems,
        );
      }

      const excludeForCount = plannedItems
        .map((i) => i.activityId)
        .filter((id): id is string => id != null && id !== "");
      let alternativesCountForSuggestion = 0;
      let suggestionVariantTotal = 0;
      let suggestionVariantPosition = 1;
      if (suggestionItem) {
        const list = getCandidatesForSlot(type, kidsForRec, scopeForRecommendations, locationFilteredPlanItems).filter((c) => {
          const aid = c.buildForDate(selectedPlanDate).activityId;
          if (!aid) return true;
          return !excludeForCount.includes(aid);
        });
        const effective =
          list.length > 0 ? list : getCandidatesForSlot(type, kidsForRec, scopeForRecommendations, locationFilteredPlanItems);
        alternativesCountForSuggestion = effective.length;
        suggestionVariantTotal = effective.length;
        suggestionVariantPosition =
          effective.length > 0 ? ((cursor % effective.length) + effective.length) % effective.length + 1 : 1;
      }

      const fullForSlot = getCandidatesForSlot(type, kidsForRec, scopeForRecommendations, locationFilteredPlanItems);
      const remainingAfterPlanned = fullForSlot.filter((c) => {
        const aid = c.buildForDate(selectedPlanDate).activityId;
        if (!aid) return true;
        return !excludeForCount.includes(aid);
      });
      const hasMoreCandidatesForAdd = remainingAfterPlanned.length > 0;

      return {
        type,
        plannedItems,
        suggestionItem,
        alternativesCountForSuggestion,
        hasMoreCandidatesForAdd,
        suggestionVariantPosition,
        suggestionVariantTotal,
      };
    });
  }, [
    accessPhase,
    children,
    scopeForRecommendations,
    slotAlternativeCursor,
    selectedPlanDate,
    slotPlanItemsByDate,
    slotPendingSuggestionByDate,
    locationFilteredPlanItems,
  ]);

  useEffect(() => {
    setSlotAlternativeCursor((prev) => {
      if (
        prev.morning === 0 &&
        prev.afternoon === 0 &&
        prev.evening === 0
      ) {
        return prev;
      }
      return { morning: 0, afternoon: 0, evening: 0 };
    });
  }, [selectedChildrenKey, selectedPlanDate, children.length]);

  const markSlotSaved = useCallback(
    (slot: PlanSlotType, item: PlanItemWithActivity) => {
      setSlotPlanItemsByDate((prev) => {
        const day = prev[selectedPlanDate] ?? {};
        const cur = day[slot] ?? [];
        if (cur.length >= MAX_PLAN_ITEMS_PER_SLOT) return prev;
        return {
          ...prev,
          [selectedPlanDate]: {
            ...day,
            [slot]: [...cur, item],
          },
        };
      });
      setSlotPendingSuggestionByDate((prev) => ({
        ...prev,
        [selectedPlanDate]: { ...prev[selectedPlanDate], [slot]: false },
      }));
    },
    [selectedPlanDate],
  );

  const clearSlotSaved = useCallback((slot: PlanSlotType, itemId: string) => {
    setSlotPlanItemsByDate((prev) => {
      const day = prev[selectedPlanDate];
      if (!day?.[slot]) return prev;
      const nextItems = day[slot].filter((i) => i.id !== itemId);
      const nextDay = { ...day };
      if (nextItems.length === 0) {
        delete nextDay[slot];
      } else {
        nextDay[slot] = nextItems;
      }
      const out = { ...prev };
      if (Object.keys(nextDay).length === 0) {
        delete out[selectedPlanDate];
      } else {
        out[selectedPlanDate] = nextDay;
      }
      return out;
    });
  }, [selectedPlanDate]);

  const removeIdea = useCallback(async (activityId: string): Promise<boolean> => {
    try {
      const res = await fetch(`/api/save/idea?activityId=${activityId}`, { method: "DELETE" });
      if (!res.ok) return false;
      setIdeas((prev) => prev.filter((idea) => idea.activityId !== activityId));
      return true;
    } catch {
      return false;
    }
  }, []);

  const resolveSlotForIdea = useCallback((): PlanSlotType => {
    const day = slotPlanItemsByDate[selectedPlanDate] ?? {};
    const order: PlanSlotType[] = ["morning", "afternoon", "evening"];
    const firstAvailable = order.find((slot) => (day[slot]?.length ?? 0) < MAX_PLAN_ITEMS_PER_SLOT);
    return firstAvailable ?? "morning";
  }, [selectedPlanDate, slotPlanItemsByDate]);

  const addIdeaToPlan = useCallback((idea: MyPlanIdea): { ok: boolean; slot?: PlanSlotType } => {
    const slot = resolveSlotForIdea();
    const planItem: PlanItemWithActivity = {
      id: `idea-${idea.id}-${selectedPlanDate}`,
      userId: "me",
      activityId: idea.activityId,
      date: selectedPlanDate,
      startsAt: null,
      title: idea.activity.title,
      coverImageUrl: idea.activity.coverImageUrl ?? null,
      createdAt: new Date(),
      activity: idea.activity,
    };
    markSlotSaved(slot, planItem);
    setIdeas((prev) =>
      prev.map((item) =>
        item.id === idea.id ? { ...item, inPlanOnDate: true } : item,
      ),
    );
    return { ok: true, slot };
  }, [markSlotSaved, resolveSlotForIdea, selectedPlanDate]);

  const openSlotSuggestion = useCallback(
    (slot: PlanSlotType) => {
      setSlotPendingSuggestionByDate((prev) => ({
        ...prev,
        [selectedPlanDate]: { ...prev[selectedPlanDate], [slot]: true },
      }));
      setSlotAlternativeCursor((prev) => ({ ...prev, [slot]: 0 }));
    },
    [selectedPlanDate],
  );

  const cycleSlotAlternative = useCallback(
    (slot: PlanSlotType) => {
      setSlotAlternativeCursor((prev) => {
        const kidsForRec = children.map((c) => ({
          id: c.id,
          birthDate: c.birthDate,
          systemInterests: c.systemInterests,
        }));
        const planned = slotPlanItemsByDate[selectedPlanDate]?.[slot] ?? [];
        const pending = slotPendingSuggestionByDate[selectedPlanDate]?.[slot] ?? false;
        const excludeIds =
          planned.length > 0 && pending
            ? planned
                .map((i) => i.activityId)
                .filter((id): id is string => id != null && id !== "")
            : [];
        const len = countSelectableCandidatesForSlot(
          slot,
          kidsForRec,
          scopeForRecommendations,
          selectedPlanDate,
          excludeIds,
          locationFilteredPlanItems,
        );
        return {
          ...prev,
          [slot]: ((prev[slot] ?? 0) + 1) % len,
        };
      });
    },
    [children, scopeForRecommendations, selectedPlanDate, slotPlanItemsByDate, slotPendingSuggestionByDate, locationFilteredPlanItems],
  );

  const cycleSlotAlternativePrev = useCallback(
    (slot: PlanSlotType) => {
      setSlotAlternativeCursor((prev) => {
        const kidsForRec = children.map((c) => ({
          id: c.id,
          birthDate: c.birthDate,
          systemInterests: c.systemInterests,
        }));
        const planned = slotPlanItemsByDate[selectedPlanDate]?.[slot] ?? [];
        const pending = slotPendingSuggestionByDate[selectedPlanDate]?.[slot] ?? false;
        const excludeIds =
          planned.length > 0 && pending
            ? planned
                .map((i) => i.activityId)
                .filter((id): id is string => id != null && id !== "")
            : [];
        const len = countSelectableCandidatesForSlot(
          slot,
          kidsForRec,
          scopeForRecommendations,
          selectedPlanDate,
          excludeIds,
          locationFilteredPlanItems,
        );
        return {
          ...prev,
          [slot]: ((prev[slot] ?? 0) - 1 + len) % len,
        };
      });
    },
    [children, scopeForRecommendations, selectedPlanDate, slotPlanItemsByDate, slotPendingSuggestionByDate, locationFilteredPlanItems],
  );

  const isLoading = authLoading || (isAuthenticated && profileLoading);

  const getWeekDates = (): string[] => {
    const today = new Date();
    const monday = new Date(today);
    const dow = today.getDay();
    const diff = dow === 0 ? -6 : 1 - dow;
    monday.setDate(today.getDate() + diff);
    return Array.from({ length: 7 }, (_, i) => {
      const date = new Date(monday);
      date.setDate(monday.getDate() + i);
      const y = date.getFullYear();
      const m = String(date.getMonth() + 1).padStart(2, "0");
      const d = String(date.getDate()).padStart(2, "0");
      return `${y}-${m}-${d}`;
    });
  };

  const weekDates = getWeekDates();

  const planItemsByDate = planItems.reduce<Record<string, PlanItemWithActivity[]>>((acc, item) => {
    if (!acc[item.date]) acc[item.date] = [];
    acc[item.date].push(item);
    return acc;
  }, {});

  const today = todayISO();
  const todayItems = planItemsByDate[today] || [];

  const filteredItems = planItems.filter(
    (item) =>
      item.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.activity?.title.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const createChild = useCallback(
    async (input: {
      name: string;
      birthMonth: number;
      birthYear: number;
      systemInterests: string[];
    }): Promise<{ ok: boolean; error?: string }> => {
      setSubmittingChild(true);
      try {
        const birthDate = new Date(input.birthYear, input.birthMonth - 1, 15);
        const res = await fetch("/api/children", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            name: input.name.trim(),
            birthDate: birthDate.toISOString(),
            systemInterests: input.systemInterests,
            customInterests: [],
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          const msg =
            typeof data.error === "string"
              ? data.error
              : "Не удалось сохранить";
          return { ok: false, error: msg };
        }
        await refetchChildren();
        requestAnimationFrame(() => {
          document.getElementById("my-plan-recommendations")?.scrollIntoView({
            behavior: "smooth",
            block: "start",
          });
        });
        return { ok: true };
      } catch {
        return { ok: false, error: "Ошибка сети" };
      } finally {
        setSubmittingChild(false);
      }
    },
    [refetchChildren],
  );

  return {
    isLoading,
    accessPhase,
    authLoading,
    profileLoading,
    children,
    selectedChildIds: childrenScope.selectedChildrenIds,
    setSelectedChildIds: childrenScope.setSelectedChildrenIds,
    selectedAgeRanges: childrenScope.selectedAgeRanges,
    setSelectedAgeRanges: childrenScope.setSelectedAgeRanges,
    autoAgeValues: childrenScope.autoAgeValues,
    submittingChild,
    createChild,
    refetchChildren,

    planItems: filteredItems,
    allPlanItems: planItems,
    planItemsByDate,
    todayItems,
    weekDates,
    searchQuery,
    setSearchQuery,
    todayCount: isAuthenticated ? todayItems.length : 0,
    planSlots,
    cycleSlotAlternative,
    cycleSlotAlternativePrev,
    markSlotSaved,
    clearSlotSaved,
    openSlotSuggestion,
    ideas,
    ideasLoading,
    refetchIdeas,
    removeIdea,
    addIdeaToPlan,
    todayIso: today,
    selectedPlanDate,
    setSelectedPlanDate,
  };
}
