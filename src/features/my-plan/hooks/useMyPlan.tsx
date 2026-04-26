"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
  type ReactNode,
} from "react";
import { useOptionalCity } from "@/contexts/CityContext";
import { useFamilyPersona } from "@/contexts/FamilyPersonaContext";
import { useDiscoveryFilters } from "@/features/filters/discovery/filters.store";
import { useChildrenScope } from "@/features/filters/discovery/childrenScope.store";

function todayISO(): string {
  return new Date().toISOString().split("T")[0];
}
import { useAuthMe } from "@/features/birthday/builder/hooks/useAuthMe";
import type { PlanItemWithActivity } from "../types/event";
import { normalizePlanItemsFromApi } from "../lib/normalizePlanItemFromApi";
import { sortPlanItemsForDay } from "../lib/sortPlanItemsForDay";
import {
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

function useMyPlanStore() {
  const cityCtx = useOptionalCity();
  const citySlug = cityCtx?.citySlug ?? "minsk";
  const { applied: locationApplied, actions: discoveryActions } = useDiscoveryFilters();
  // Не вызываем useDiscoveryFilterOptions здесь — он делает fetch при каждом mount.
  // locationOptions нужны только для фильтрации по metro/district, которая некритична для открытия.
  const locationOptions = useMemo(() => ({ metros: [] as { value: string; label: string }[], districts: [] as { value: string; label: string }[] }), []);
  const { isAuthenticated, isLoading: authLoading } = useAuthMe();
  const family = useFamilyPersona();

  const [children, setChildren] = useState<ProfileChild[]>([]);
  const [profileLoading, setProfileLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPlanDate, setSelectedPlanDate] = useState<string>(todayISO);
  const [submittingChild, setSubmittingChild] = useState(false);

  /** Chronological plan items by date - sorted by startsAt */
  const [planItemsByDateMap, setPlanItemsByDateMap] = useState<
    Record<string, PlanItemWithActivity[]>
  >({});
  /** Актуальный снимок для проверки дублей в async-колбэках без устаревшего замыкания. */
  const planItemsByDateMapRef = useRef(planItemsByDateMap);
  planItemsByDateMapRef.current = planItemsByDateMap;
  const [ideas, setIdeas] = useState<MyPlanIdea[]>([]);
  const [ideasLoading, setIdeasLoading] = useState(false);
  /** События из каталога для блока «Рекомендации» (не путать с сохранёнными идеями). */
  const [planSuggestions, setPlanSuggestions] = useState<
    NonNullable<MyPlanIdea["activity"]>[]
  >([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);

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
    // Children уже загружены в FamilyPersonaContext — не дублируем запрос при mount.
    // refetchChildren вызывается явно только после создания нового ребёнка.
  }, [isAuthenticated, authLoading]);

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

  const planSuggestionExcludeSignature = useMemo(() => {
    const ids = new Set<string>();
    for (const idea of ideas) ids.add(idea.activityId);
    for (const item of planItemsByDateMap[selectedPlanDate] ?? []) {
      if (item.activityId) ids.add(item.activityId);
    }
    return [...ids].sort().join(",");
  }, [ideas, planItemsByDateMap, selectedPlanDate]);

  const selectedAgeRangesKey = useMemo(
    () =>
      childrenScope.selectedAgeRanges
        .map((r) => r.range)
        .filter(Boolean)
        .sort()
        .join(","),
    [childrenScope.selectedAgeRanges],
  );

  const refetchPlanSuggestions = useCallback(async () => {
    if (!isAuthenticated) {
      setPlanSuggestions([]);
      return;
    }
    setSuggestionsLoading(true);
    try {
      const qs = new URLSearchParams();
      qs.set("city", citySlug);
      qs.set("date", selectedPlanDate);
      if (planSuggestionExcludeSignature.length > 0) {
        qs.set("exclude", planSuggestionExcludeSignature.split(",").filter(Boolean).join(","));
      }
      if (selectedAgeRangesKey.length > 0) {
        qs.set("ageRanges", selectedAgeRangesKey);
      }
      const res = await fetch(`/api/plan/suggestions?${qs.toString()}`, {
        credentials: "include",
      });
      if (!res.ok) {
        setPlanSuggestions([]);
        return;
      }
      const data = (await res.json()) as {
        suggestions?: NonNullable<MyPlanIdea["activity"]>[];
      };
      const list = Array.isArray(data.suggestions) ? data.suggestions : [];
      setPlanSuggestions(list);
    } catch {
      setPlanSuggestions([]);
    } finally {
      setSuggestionsLoading(false);
    }
  }, [
    isAuthenticated,
    citySlug,
    selectedPlanDate,
    planSuggestionExcludeSignature,
    selectedAgeRangesKey,
  ]);

  useEffect(() => {
    if (!isAuthenticated || authLoading) {
      setPlanSuggestions([]);
      return;
    }
    // Suggestions загружаются только по явному запросу (кнопка "Реши за меня")
    // Не грузим при mount — это ускоряет открытие модалки
  }, [isAuthenticated, authLoading]);

  const selectedPersonaIdsForPlan = useMemo(
    () => family?.selectedPersonaIds ?? [],
    [family?.selectedPersonaIds],
  );

  const planDayFetchGen = useRef(0);

  const refetchPlanForDate = useCallback(
    async (date: string) => {
      if (!isAuthenticated || authLoading) return;
      const gen = ++planDayFetchGen.current;
      try {
        const res = await fetch(
          `/api/save/plan/day?date=${encodeURIComponent(date)}`,
          { credentials: "include" },
        );
        if (!res.ok) return;
        if (gen !== planDayFetchGen.current) return;
        const data = (await res.json()) as { items?: unknown[] };
        const raw = Array.isArray(data.items) ? data.items : [];
        const items = sortPlanItemsForDay(normalizePlanItemsFromApi(raw));
        setPlanItemsByDateMap((prev) => ({
          ...prev,
          [date]: items,
        }));
      } catch {
        /* ignore */
      }
    },
    [isAuthenticated, authLoading],
  );

  const today = todayISO();

  // Загружаем план на сегодня при mount — чтобы compact widget сразу показывал актуальные данные
  useEffect(() => {
    if (!isAuthenticated || authLoading) return;
    void refetchPlanForDate(today);
  }, [isAuthenticated, authLoading, refetchPlanForDate, today]);

  const postActivityToPlan = useCallback(
    async (input: {
      activityId: string;
      title: string;
      coverImageUrl?: string | null;
      planAddSource: "recommendation" | "idea";
    }) => {
      const res = await fetch("/api/save/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          activityId: input.activityId,
          date: selectedPlanDate,
          title: input.title,
          coverImageUrl: input.coverImageUrl ?? undefined,
          selectedPersonaIds: selectedPersonaIdsForPlan,
          planAddSource: input.planAddSource,
        }),
      });
      if (!res.ok) return { ok: false as const, planItemId: null as string | null };
      const data = (await res.json()) as { planItem?: { id: string } };
      const planItemId = data.planItem?.id ?? null;
      if (!planItemId) return { ok: false as const, planItemId: null };
      return { ok: true as const, planItemId };
    },
    [selectedPlanDate, selectedPersonaIdsForPlan],
  );

  const accessPhase: PlanAccessPhase = useMemo(() => {
    if (authLoading) return "loading";
    if (!isAuthenticated) return "no_children";
    if (profileLoading) return "loading";
    // Always allow access to My Plan, even without children
    return "ready";
  }, [isAuthenticated, authLoading, profileLoading]);

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
    // DEPRECATED: Kept for backward compatibility but returns empty array
    // New UI should use planItemsByDate directly
    return [];
  }, []);

  const addPlanItem = useCallback(
    (item: PlanItemWithActivity) => {
      setPlanItemsByDateMap((prev) => {
        const day = prev[selectedPlanDate] ?? [];
        if (day.some((i) => i.id === item.id)) {
          const replaced = day.map((i) => (i.id === item.id ? item : i));
          return {
            ...prev,
            [selectedPlanDate]: sortPlanItemsForDay(replaced),
          };
        }
        const withoutActivityDup = day.filter(
          (i) => i.activityId == null || i.activityId !== item.activityId,
        );
        const updated = sortPlanItemsForDay([...withoutActivityDup, item]);
        return {
          ...prev,
          [selectedPlanDate]: updated,
        };
      });
    },
    [selectedPlanDate],
  );

  const removePlanItemLocal = useCallback(
    (itemId: string) => {
      setPlanItemsByDateMap((prev) => {
        const day = prev[selectedPlanDate];
        if (!day) return prev;
        const updated = day.filter((i) => i.id !== itemId);
        const out = { ...prev };
        if (updated.length === 0) {
          delete out[selectedPlanDate];
        } else {
          out[selectedPlanDate] = updated;
        }
        return out;
      });
    },
    [selectedPlanDate],
  );

  /** Удаление пункта плана на сервере и в локальном состоянии. */
  const removePlanItemFromDay = useCallback(
    async (planItemId: string): Promise<boolean> => {
      try {
        const res = await fetch(
          `/api/save/plan?planItemId=${encodeURIComponent(planItemId)}`,
          { method: "DELETE", credentials: "include" },
        );
        if (!res.ok) return false;
        removePlanItemLocal(planItemId);
        void refetchPlanForDate(selectedPlanDate);
        return true;
      } catch {
        return false;
      }
    },
    [removePlanItemLocal, refetchPlanForDate, selectedPlanDate],
  );

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

  const cycleSlotAlternative = useCallback(
    () => {
      // DEPRECATED: Kept for backward compatibility
    },
    [],
  );

  const cycleSlotAlternativePrev = useCallback(
    () => {
      // DEPRECATED: Kept for backward compatibility
    },
    [],
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
    planItemsByDate: planItemsByDateMap,
    todayItems: planItemsByDateMap[today] ?? [],
    weekDates,
    searchQuery,
    setSearchQuery,
    todayCount: isAuthenticated ? (planItemsByDateMap[today] ?? []).length : 0,
    /** Суммарное кол-во элементов на ближайшие 7 дней (включая сегодня) */
    weekItemsCount: isAuthenticated
      ? weekDates.reduce((sum, d) => sum + (planItemsByDateMap[d]?.length ?? 0), 0)
      : 0,
    /** Ближайший элемент плана после сегодня (для compact widget) */
    nextPlanItem: isAuthenticated
      ? (() => {
          for (const d of weekDates) {
            if (d <= today) continue; // пропускаем сегодня и прошлое
            const items = planItemsByDateMap[d];
            if (items && items.length > 0) return { date: d, item: items[0] };
          }
          return null;
        })()
      : null,
    planSlots,
    cycleSlotAlternative,
    cycleSlotAlternativePrev,
    markSlotSaved: addPlanItem,
    clearSlotSaved: removePlanItemFromDay,
    openSlotSuggestion: () => {},
    ideas,
    ideasLoading,
    refetchIdeas,
    removeIdea,
    addIdeaToPlan: async (idea: MyPlanIdea): Promise<{ ok: boolean }> => {
      try {
        const day = planItemsByDateMapRef.current[selectedPlanDate] ?? [];
        if (day.some((i) => i.activityId === idea.activityId)) {
          return { ok: true };
        }

        const { ok, planItemId } = await postActivityToPlan({
          activityId: idea.activityId,
          title: idea.activity.title,
          coverImageUrl: idea.activity.coverImageUrl,
          planAddSource: "idea",
        });
        if (!ok || !planItemId) return { ok: false };

        const planItem: PlanItemWithActivity = {
          id: planItemId,
          userId: "me",
          activityId: idea.activityId,
          date: selectedPlanDate,
          startsAt: null,
          title: idea.activity.title,
          coverImageUrl: idea.activity.coverImageUrl ?? null,
          createdAt: new Date(),
          activity: idea.activity,
        };
        addPlanItem(planItem);
        setIdeas((prev) =>
          prev.map((item) =>
            item.id === idea.id ? { ...item, inPlanOnDate: true } : item,
          ),
        );
        void refetchPlanForDate(selectedPlanDate);
        return { ok: true };
      } catch {
        return { ok: false };
      }
    },
    planSuggestions,
    suggestionsLoading,
    refetchPlanSuggestions,
    addActivityToPlanFromSuggestion: async (
      activity: NonNullable<MyPlanIdea["activity"]>,
    ): Promise<{ ok: boolean }> => {
      try {
        const dayExisting = planItemsByDateMapRef.current[selectedPlanDate] ?? [];
        if (dayExisting.some((i) => i.activityId === activity.id)) {
          return { ok: true };
        }

        const { ok, planItemId } = await postActivityToPlan({
          activityId: activity.id,
          title: activity.title,
          coverImageUrl: activity.coverImageUrl,
          planAddSource: "recommendation",
        });
        if (!ok || !planItemId) return { ok: false };

        const planItem: PlanItemWithActivity = {
          id: planItemId,
          userId: "me",
          activityId: activity.id,
          date: selectedPlanDate,
          startsAt: null,
          title: activity.title,
          coverImageUrl: activity.coverImageUrl ?? null,
          createdAt: new Date(),
          activity,
        };
        addPlanItem(planItem);
        void refetchPlanForDate(selectedPlanDate);
        return { ok: true };
      } catch {
        return { ok: false };
      }
    },
    refetchPlanForDate,
    todayIso: today,
    selectedPlanDate,
    setSelectedPlanDate,
  };
}
