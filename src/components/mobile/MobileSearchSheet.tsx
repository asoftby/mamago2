"use client";

/* eslint-disable react-hooks/set-state-in-effect --
   Sheet open: sync local draft from URL; intent sync when sheet closes. */

import {
  useState,
  useEffect,
  useLayoutEffect,
  useRef,
  useCallback,
  useMemo,
  type ReactNode,
} from "react";
import { ChevronDown } from "lucide-react";
import { useRouter } from "next/navigation";
import { ModalCloseButton } from "@/components/ui/modal-close-button";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  useDiscoveryFilters,
  mergeDiscoveryPatch,
  defaultFilters,
  type DiscoveryFilters,
} from "@/features/filters/discovery/filters.store";
import { useDiscoveryFilterOptions } from "@/features/filters/discovery/filters.api";
import { DatePanel, AgePanel } from "@/components/site/header/search-segments";
import { MobileLocationPanel } from "@/components/mobile/panels/MobileLocationPanel";
import {
  DISCOVERY_INTENT_CONFIG,
} from "@/lib/discovery/discoveryIntentConfig";
import { getCityLocativePhrase } from "@/lib/city/cityDisplayNames";
import { useAuthMe } from "@/features/birthday/builder/hooks/useAuthMe";
import { useFamilyPersona } from "@/contexts/FamilyPersonaContext";
import { useChildrenScope } from "@/features/filters/discovery/childrenScope.store";
import { formatWhoHeaderSummary } from "@/lib/family/formatWhoHeaderSummary";
import {
  hasSelectedChildren as familyHasSelectedChildren,
  resolveFamilyAgeMode,
} from "@/lib/family/familyAgeMode";
import { MAX_ACTIVE_FAMILY_PERSONAS } from "@/lib/family/wholeFamilyPreset";
import { MobileSearch } from "@/components/mobile/MobileSearch";
import type { SearchResultItem } from "@/lib/search/types";

/** Единый для всех разделов: пользователь хотя бы раз открыл и закрыл поиск в этой вкладке браузера */
const SEARCH_FLOW_USED_KEY = "mmg.discovery.searchFlowUsed";
const LEGACY_FLOW_USED_BY_INTENT_KEY = "mmg.discovery.searchFlowUsedByIntent";

function readFlowUsedGlobal(): boolean {
  if (typeof window === "undefined") return false;
  if (sessionStorage.getItem(SEARCH_FLOW_USED_KEY) === "1") return true;
  try {
    const raw = sessionStorage.getItem(LEGACY_FLOW_USED_BY_INTENT_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw) as unknown;
    if (
      parsed &&
      typeof parsed === "object" &&
      !Array.isArray(parsed) &&
      Object.values(parsed as Record<string, boolean>).some(Boolean)
    ) {
      sessionStorage.setItem(SEARCH_FLOW_USED_KEY, "1");
      sessionStorage.removeItem(LEGACY_FLOW_USED_BY_INTENT_KEY);
      return true;
    }
  } catch {
    /* ignore */
  }
  return false;
}

function writeFlowUsedGlobal(used: boolean) {
  if (typeof window === "undefined") return;
  try {
    if (used) {
      sessionStorage.setItem(SEARCH_FLOW_USED_KEY, "1");
    } else {
      sessionStorage.removeItem(SEARCH_FLOW_USED_KEY);
    }
  } catch {
    /* ignore */
  }
}

interface MobileSearchSheetProps {
  isOpen: boolean;
  onClose: () => void;
  citySlug?: string;
  currentIntent?: string;
  /** Городской хаб: поиск + город, как на десктопе */
  cityHubOnly?: boolean;
}

type AccordionSection = "location" | "date" | "age";

const SECTION_ORDER: AccordionSection[] = ["location", "date", "age"];

function buildDiscoveryPath(city: string, intent: string | null): string {
  if (intent === null) return `/${city}`;
  const cfg =
    DISCOVERY_INTENT_CONFIG[intent as keyof typeof DISCOVERY_INTENT_CONFIG];
  return cfg?.href(city) ?? `/${city}`;
}

function cloneFilters(f: DiscoveryFilters): DiscoveryFilters {
  return { ...f, age: [...f.age] };
}

function filtersSnapshotEqual(a: DiscoveryFilters, b: DiscoveryFilters): boolean {
  if (
    a.dateFrom !== b.dateFrom ||
    a.dateTo !== b.dateTo ||
    a.whenPreset !== b.whenPreset ||
    a.metro !== b.metro ||
    a.district !== b.district ||
    a.nearby !== b.nearby ||
    a.age.length !== b.age.length
  ) {
    return false;
  }
  const sa = [...a.age].sort().join("\0");
  const sb = [...b.age].sort().join("\0");
  return sa === sb;
}

function hasFilterContent(d: DiscoveryFilters): boolean {
  return !!(
    d.nearby ||
    d.metro ||
    d.district ||
    d.whenPreset ||
    d.dateFrom ||
    d.dateTo ||
    d.age.length > 0
  );
}

/** Non-city filters only (city is not part of DiscoveryFilters). */
const hasNonCityFilters = hasFilterContent;

/**
 * wizard: на «Где» без правок — оранжевая «Показать» (сразу в выдачу); после начала фильтра — «Далее»;
 * «Когда» — «Далее» / «Пропустить»; «С кем» — всегда оранжевая «Показать» (в т.ч. без возраста).
 *
 * bypassFlowUsed: после выбора раздела с главной / переключения таба в шите —
 * снова ведём по шагам, даже если поиск уже «использовали» глобально.
 */
function deriveSearchFlowMode(
  intent: string,
  baseline: { filters: DiscoveryFilters; intent: string | null } | null,
  flowUsedGlobally: boolean,
  bypassFlowUsed: boolean,
): "wizard" | "refine" {
  if (
    baseline &&
    baseline.intent === intent &&
    hasNonCityFilters(baseline.filters)
  ) {
    return "refine";
  }
  if (flowUsedGlobally && !bypassFlowUsed) return "refine";
  return "wizard";
}

export function MobileSearchSheet({
  isOpen,
  onClose,
  citySlug = "minsk",
  currentIntent,
  cityHubOnly = false,
}: MobileSearchSheetProps) {
  const router = useRouter();
  const { applied, actions } = useDiscoveryFilters();

  const [activeSection, setActiveSection] = useState<AccordionSection | null>(
    null,
  );
  const [flowUsedGlobal, setFlowUsedGlobal] = useState(false);
  /** true: только что выбрали раздел с хаба или переключили таб — снова мастер-путь */
  const [bypassFlowUsed, setBypassFlowUsed] = useState(false);
  const [searchText, setSearchText] = useState("");
  /** На главной города без раздела в URL — null, пока пользователь не выбрал раздел в шите */
  const [selectedIntent, setSelectedIntent] = useState<string | null>(null);
  const prevIsOpenRef = useRef(false);
  /** Область прокрутки контента шита — сброс вверх при открытии, чтобы строка поиска была видна */
  const scrollRegionRef = useRef<HTMLDivElement>(null);
  const prevIntentForAccordionRef = useRef<string | null>(null);
  const sectionRefs = useRef<
    Partial<Record<AccordionSection, HTMLDivElement | null>>
  >({});

  const [sheetDraft, setSheetDraft] = useState<DiscoveryFilters>(defaultFilters);
  const [pendingCitySlug, setPendingCitySlug] = useState(citySlug);
  const [sheetBaseline, setSheetBaseline] = useState<{
    filters: DiscoveryFilters;
    city: string;
    /** null = в URL ещё не было раздела (главная города) */
    intent: string | null;
  } | null>(null);

  const patchSheetDraft = useCallback((patch: Partial<DiscoveryFilters>) => {
    setSheetDraft((prev) => mergeDiscoveryPatch(prev, patch));
  }, []);

  const markSearchFlowUsed = useCallback(() => {
    setFlowUsedGlobal((prev) => {
      if (prev) return prev;
      writeFlowUsedGlobal(true);
      return true;
    });
  }, []);

  const handleSheetClose = useCallback(() => {
    markSearchFlowUsed();
    onClose();
  }, [markSearchFlowUsed, onClose]);

  const handleSearchResultNavigate = useCallback(
    (item: SearchResultItem) => {
      router.push(item.url);
      handleSheetClose();
    },
    [router, handleSheetClose],
  );

  const sheetActions = useMemo(
    () => ({
      ...actions,
      setDraft: patchSheetDraft,
    }),
    [actions, patchSheetDraft],
  );

  const { options: apiOptions } = useDiscoveryFilterOptions(pendingCitySlug);
  const safeApiOptions = useMemo(
    () =>
      apiOptions ?? {
        districts: [],
        metros: [],
        ages: [],
      },
    [apiOptions],
  );

  const { isAuthenticated } = useAuthMe();
  const family = useFamilyPersona();

  const profileChildren = useMemo(
    () =>
      isAuthenticated && family && !family.loading
        ? family.childPersonasForFilter
        : [],
    [isAuthenticated, family],
  );

  const setSheetAgeRanges = useCallback((nextAge: string[]) => {
    patchSheetDraft({ age: nextAge });
  }, [patchSheetDraft]);

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
    citySlug: pendingCitySlug,
    availableChildren: profileChildren,
    appliedAgeRanges: sheetDraft.age ?? [],
    setAppliedAgeRanges: setSheetAgeRanges,
    familySync: childrenFamilySync,
  });

  const showChildrenPreset = isAuthenticated && profileChildren.length > 0;
  const allowMultiChildSelect = profileChildren.length >= 2;
  // Always use first persona ID if it's an adult
  const primaryAdultPersonaId = family?.personas?.[0]?.kind === "adult" ? family.personas[0].id : null;
  const adultSelected =
    !!primaryAdultPersonaId &&
    !!family?.selectedPersonaIds.includes(primaryAdultPersonaId);

  const profileChildIds = useMemo(
    () => profileChildren.map((c) => c.id),
    [profileChildren],
  );

  const ageMode = resolveFamilyAgeMode({
    hasProfileChildren: showChildrenPreset,
    selectedPersonaIds: family?.selectedPersonaIds ?? [],
    profileChildIds,
  });

  useEffect(() => {
    if (!isOpen) return;
    setSheetDraft((prev) => {
      const pa = [...(prev.age ?? [])].sort().join(",");
      const aa = [...(applied.age ?? [])].sort().join(",");
      if (pa === aa) return prev;
      return mergeDiscoveryPatch(prev, { age: [...(applied.age ?? [])] });
    });
  }, [isOpen, applied.age]);

  /**
   * Toggle persona selection - same logic as in My Plan
   */
  const togglePersona = useCallback(
    (personaId: string) => {
      if (!family?.setSelectedPersonaIds) return;
      
      const isSelected = family.selectedPersonaIds.includes(personaId);
      
      if (isSelected) {
        // Deselect persona
        const newIds = family.selectedPersonaIds.filter((id) => id !== personaId);
        family.setSelectedPersonaIds(newIds);
        
        // If no personas left, clear age filters (enters free search mode)
        if (newIds.length === 0) {
          setSheetDraft((prev) => ({ ...prev, age: [] }));
        }
      } else {
        // Select persona (exits free search mode automatically)
        const newIds = [...family.selectedPersonaIds, personaId];
        family.setSelectedPersonaIds(newIds);
      }
    },
    [family],
  );

  /**
   * Toggle free search mode - clears all persona selections
   */
  const handleSelectFreeMode = useCallback(() => {
    if (!family?.setSelectedPersonaIds) return;
    
    // Switch to free mode: clear all selections via FamilyPersonaContext
    family.setSelectedPersonaIds([]);
    // Clear age filters
    setSheetDraft((prev) => ({ ...prev, age: [] }));
  }, [family]);

  const toggleChild = useCallback(
    (childId: string) => {
      togglePersona(childId);
    },
    [togglePersona],
  );

  const toggleAdult = useCallback(() => {
    if (!primaryAdultPersonaId) return;
    togglePersona(primaryAdultPersonaId);
  }, [primaryAdultPersonaId, togglePersona]);

  const hasSelectedChildren = familyHasSelectedChildren(
    family?.selectedPersonaIds ?? [],
    profileChildIds,
  );

  const whoPrimaryLine = useMemo(() => {
    if (ageMode === "free" && showChildrenPreset) {
      return "Свободный поиск";
    }
    return formatWhoHeaderSummary({
      hasSelectedChildren,
      selectedPersonaIds: family?.selectedPersonaIds ?? [],
      personas: family?.personas ?? [],
      fallbackAgeValues: sheetDraft.age ?? [],
    });
  }, [
    ageMode,
    showChildrenPreset,
    hasSelectedChildren,
    family?.selectedPersonaIds,
    family?.personas,
    sheetDraft.age,
  ]);

  const ageSheetActions = useMemo(
    () => ({
      setDraft: (patch: Partial<DiscoveryFilters>) => {
        if (Array.isArray(patch.age)) {
          if (ageMode === "derived") return;
          patchSheetDraft({ age: patch.age });
          return;
        }
        patchSheetDraft(patch);
      },
    }),
    [ageMode, patchSheetDraft],
  );

  const isHubPickMode =
    Boolean(cityHubOnly) &&
    currentIntent == null &&
    selectedIntent == null;

  useLayoutEffect(() => {
    if (isOpen && !prevIsOpenRef.current) {
      const baselineFilters = cloneFilters(applied);
      const nextDraft = cloneFilters(applied);
      const flowUsed = readFlowUsedGlobal();
      setFlowUsedGlobal(flowUsed);
      /** Пустой снимок: снова ведём по шагам (Далее…), даже если поиск уже закрывали ранее */
      const emptySnapshot =
        !hasNonCityFilters(nextDraft) &&
        !(currentIntent != null && hasNonCityFilters(baselineFilters));
      const bypassForOpen =
        !(cityHubOnly && currentIntent == null) && emptySnapshot && flowUsed;
      setBypassFlowUsed(bypassForOpen);
      setSheetDraft(nextDraft);
      setPendingCitySlug(citySlug);
      setSearchText("");
      if (cityHubOnly && currentIntent == null) {
        setSelectedIntent(null);
      } else {
        setSelectedIntent(currentIntent || "kuda");
      }
      setSheetBaseline({
        filters: baselineFilters,
        city: citySlug,
        intent: currentIntent ?? null,
      });

      if (cityHubOnly && currentIntent == null) {
        setActiveSection(null);
      } else {
        const effectiveIntent = currentIntent || "kuda";
        const mode = deriveSearchFlowMode(
          effectiveIntent,
          {
            filters: baselineFilters,
            intent: currentIntent ?? null,
          },
          flowUsed,
          bypassForOpen,
        );
        setActiveSection(mode === "wizard" ? "location" : null);
      }
      prevIntentForAccordionRef.current = null;
    }
    prevIsOpenRef.current = isOpen;
  }, [isOpen, applied, citySlug, currentIntent, cityHubOnly]);

  useEffect(() => {
    if (!isOpen) {
      if (cityHubOnly && currentIntent == null) {
        setSelectedIntent(null);
      } else {
        setSelectedIntent(currentIntent || "kuda");
      }
    }
  }, [currentIntent, isOpen, cityHubOnly]);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen]);

  /** Пользователь менял хотя бы один фильтр относительно baseline при открытии шита */
  const dirty = useMemo(() => {
    if (!sheetBaseline) return false;
    const baselineIntent = sheetBaseline.intent ?? null;
    const effectiveIntent = selectedIntent ?? null;
    return (
      !filtersSnapshotEqual(sheetDraft, sheetBaseline.filters) ||
      pendingCitySlug !== sheetBaseline.city ||
      effectiveIntent !== baselineIntent
    );
  }, [sheetDraft, pendingCitySlug, selectedIntent, sheetBaseline]);

  const searchFlowMode = useMemo((): "wizard" | "refine" => {
    const intent = selectedIntent ?? currentIntent ?? null;
    if (!intent) return "refine";
    return deriveSearchFlowMode(
      intent,
      sheetBaseline,
      flowUsedGlobal,
      bypassFlowUsed,
    );
  }, [
    selectedIntent,
    currentIntent,
    sheetBaseline,
    flowUsedGlobal,
    bypassFlowUsed,
  ]);

  /** When user switches intent tab, reset accordion position for the new section’s mode. */
  useEffect(() => {
    if (!isOpen) {
      prevIntentForAccordionRef.current = null;
      return;
    }
    if (selectedIntent == null) return;

    const prev = prevIntentForAccordionRef.current;

    if (prev === null) {
      prevIntentForAccordionRef.current = selectedIntent;
      return;
    }

    if (prev === selectedIntent) {
      return;
    }

    prevIntentForAccordionRef.current = selectedIntent;
    setBypassFlowUsed(true);
    const mode = deriveSearchFlowMode(
      selectedIntent,
      sheetBaseline,
      flowUsedGlobal,
      true,
    );
    setActiveSection(mode === "wizard" ? "location" : null);
  }, [selectedIntent, isOpen, sheetBaseline, flowUsedGlobal]);

  const handleResetAll = useCallback(() => {
    const intentForPath = selectedIntent ?? currentIntent ?? "kuda";
    const path = buildDiscoveryPath(citySlug, intentForPath);
    actions.commitFilters(defaultFilters, path);
    setSheetDraft(cloneFilters(defaultFilters));
    setPendingCitySlug(citySlug);
    setFlowUsedGlobal(false);
    writeFlowUsedGlobal(false);
    setBypassFlowUsed(false);
    const mode = deriveSearchFlowMode(
      intentForPath,
      {
        filters: cloneFilters(defaultFilters),
        intent: currentIntent ?? null,
      },
      false,
      false,
    );
    setActiveSection(mode === "wizard" ? "location" : null);
    setSheetBaseline({
      filters: cloneFilters(defaultFilters),
      city: citySlug,
      intent: currentIntent ?? null,
    });
    toast.success("Фильтры сброшены");
  }, [actions, citySlug, selectedIntent, currentIntent]);

  const handleIntentSelect = useCallback(
    (intentId: string) => {
      if (selectedIntent === intentId) return;
      setSelectedIntent(intentId);
      const cleared = cloneFilters(defaultFilters);
      setSheetDraft(cleared);
      setPendingCitySlug(citySlug);
      setSearchText("");
      setSheetBaseline({
        filters: cloneFilters(defaultFilters),
        city: citySlug,
        intent: intentId,
      });
      if (cityHubOnly && currentIntent == null) {
        setBypassFlowUsed(true);
        const mode = deriveSearchFlowMode(
          intentId,
          {
            filters: cleared,
            intent: intentId,
          },
          flowUsedGlobal,
          true,
        );
        setActiveSection(mode === "wizard" ? "location" : null);
      }
    },
    [selectedIntent, cityHubOnly, currentIntent, citySlug, flowUsedGlobal],
  );

  const goNextGuided = useCallback(() => {
    setActiveSection((prev) => {
      if (!prev) return "location";
      const i = SECTION_ORDER.indexOf(prev);
      if (i < SECTION_ORDER.length - 1) return SECTION_ORDER[i + 1]!;
      return prev;
    });
  }, []);

  const handleSectionHeaderClick = useCallback(
    (section: AccordionSection) => {
      setActiveSection((prev) => (prev === section ? null : section));
    },
    [],
  );

  const getLocationText = useCallback(() => {
    const cityPhrase = getCityLocativePhrase(pendingCitySlug);
    const nearbyPart = sheetDraft.nearby ? "Поблизости" : null;
    
    let metroOrDistrictPart: string | null = null;
    if (sheetDraft.metro) {
      const metro = safeApiOptions.metros.find(
        (m) => m.value === sheetDraft.metro,
      );
      if (metro) metroOrDistrictPart = metro.label;
    }
    if (sheetDraft.district) {
      const district = safeApiOptions.districts.find(
        (d) => d.value === sheetDraft.district,
      );
      if (district) metroOrDistrictPart = district.label;
    }
    
    const items = [cityPhrase, nearbyPart, metroOrDistrictPart].filter((p): p is string => p != null);
    return items.join(" • ");
  }, [pendingCitySlug, sheetDraft, safeApiOptions]);

  const getDateText = useCallback(() => {
    if (sheetDraft.whenPreset === "TODAY") return "Сегодня";
    if (sheetDraft.whenPreset === "TOMORROW") return "Завтра";
    if (sheetDraft.whenPreset === "WEEKEND") return "Выходные";
    if (sheetDraft.dateFrom) {
      const fromDate = new Date(sheetDraft.dateFrom);
      if (sheetDraft.dateTo && sheetDraft.dateFrom !== sheetDraft.dateTo) {
        const toDate = new Date(sheetDraft.dateTo);
        const fromDay = fromDate.getDate();
        const toDay = toDate.getDate();
        const fromMonth = fromDate.getMonth();
        const toMonth = toDate.getMonth();
        const months = [
          "янв",
          "фев",
          "мар",
          "апр",
          "май",
          "июн",
          "июл",
          "авг",
          "сен",
          "окт",
          "ноя",
          "дек",
        ];
        if (fromMonth === toMonth) {
          return `${fromDay}–${toDay} ${months[fromMonth]}`;
        }
        return `${fromDay} ${months[fromMonth]}–${toDay} ${months[toMonth]}`;
      }
      const day = fromDate.getDate();
      const month = [
        "янв",
        "фев",
        "мар",
        "апр",
        "май",
        "июн",
        "июл",
        "авг",
        "сен",
        "окт",
        "ноя",
        "дек",
      ][fromDate.getMonth()];
      return `${day} ${month}`;
    }
    return "Выберите даты";
  }, [sheetDraft]);

  const showResetAll = hasFilterContent(sheetDraft);

  /** Выбор в первом блоке (город / район / метро / поблизости) — показываем «Сбросить» слева в мастере. */
  const hasLocationSelections = useMemo(() => {
    return !!(
      sheetDraft.nearby ||
      sheetDraft.metro ||
      sheetDraft.district ||
      (sheetBaseline != null && pendingCitySlug !== sheetBaseline.city)
    );
  }, [
    sheetDraft.nearby,
    sheetDraft.metro,
    sheetDraft.district,
    pendingCitySlug,
    sheetBaseline,
  ]);

  const showLeftReset =
    searchFlowMode === "refine"
      ? showResetAll
      : searchFlowMode === "wizard" && activeSection === "location"
        ? hasLocationSelections
        : searchFlowMode === "wizard" && activeSection === "age"
          ? showResetAll
          : false;

  /** Шаг «Где» (или ещё не раскрыт аккордеон): без правок фильтров показываем «Показать», после правок — «Далее». */
  const wizardLocationLike =
    searchFlowMode === "wizard" &&
    (activeSection === "location" || activeSection === null);

  const bottomPrimaryLabel =
    searchFlowMode === "wizard"
      ? activeSection === "age"
        ? "Показать"
        : wizardLocationLike && !dirty
          ? "Показать"
          : "Далее"
      : "Показать";

  const handleBottomPrimaryClick = useCallback(() => {
    if (searchFlowMode === "wizard") {
      if (wizardLocationLike && !dirty) {
        if (selectedIntent == null) {
          handleSheetClose();
          return;
        }
        const targetPath = buildDiscoveryPath(pendingCitySlug, selectedIntent);
        actions.commitFilters(sheetDraft, targetPath);
        handleSheetClose();
        return;
      }
      if (activeSection !== "age") {
        goNextGuided();
        return;
      }
    }
    if (!dirty) {
      handleSheetClose();
      return;
    }
    if (selectedIntent == null) {
      handleSheetClose();
      return;
    }
    const targetPath = buildDiscoveryPath(pendingCitySlug, selectedIntent);
    actions.commitFilters(sheetDraft, targetPath);
    handleSheetClose();
  }, [
    searchFlowMode,
    activeSection,
    wizardLocationLike,
    goNextGuided,
    dirty,
    selectedIntent,
    actions,
    pendingCitySlug,
    sheetDraft,
    handleSheetClose,
  ]);

  /** При открытии шита — с верху экрана (строка поиска + табы), без смещения вниз */
  useLayoutEffect(() => {
    if (!isOpen) return;
    scrollRegionRef.current?.scrollTo(0, 0);
  }, [isOpen]);

  /**
   * После «Далее» подводим следующую карточку (Когда / С кем).
   * Для шага «Где» не скроллим: иначе scrollIntoView уводит аккордеон к верху области и скрывает строку поиска.
   */
  useLayoutEffect(() => {
    if (!isOpen || isHubPickMode) return;
    if (!activeSection || activeSection === "location") return;
    const el = sectionRefs.current[activeSection];
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "start", inline: "nearest" });
  }, [activeSection, isOpen, isHubPickMode]);

  if (!isOpen) return null;

  const renderAccordion = (
    id: AccordionSection,
    title: string,
    summary: string,
    children: ReactNode,
  ) => {
    const expanded = activeSection === id;

    return (
      <div
        ref={(node) => {
          sectionRefs.current[id] = node;
        }}
        className="scroll-mt-3 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm"
      >
        <button
          type="button"
          onClick={() => handleSectionHeaderClick(id)}
          className="flex w-full items-center justify-between p-4 text-left transition-colors hover:bg-gray-50 active:bg-gray-100/80"
        >
          <div className="min-w-0 pr-3">
            <div className="text-[15px] font-semibold tracking-tight text-gray-900">
              {title}
            </div>
            <div
              className={cn(
                "mt-0.5 line-clamp-2 text-sm",
                expanded ? "text-gray-600" : "text-gray-500",
              )}
            >
              {summary}
            </div>
          </div>
          <ChevronDown
            className={cn(
              "h-5 w-5 shrink-0 text-gray-400 transition-transform duration-200",
              expanded && "rotate-180",
            )}
          />
        </button>
        {expanded ? (
          <div className="border-t border-gray-100 bg-gray-50/90">
            {children}
          </div>
        ) : null}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-[9999] flex min-h-0 flex-col bg-white">
      <div className="sticky top-0 z-10 shrink-0 border-b border-gray-100 bg-white px-4 py-3">
        <div className="flex items-center justify-between">
          <ModalCloseButton
            onClick={handleSheetClose}
            className="-ml-2 shrink-0"
          />
          <h2 className="text-lg font-semibold text-gray-900">Поиск</h2>
          <div className="w-10" />
        </div>
      </div>

      <div
        ref={scrollRegionRef}
        className={cn(
          "min-h-0 flex-1 overflow-y-auto",
          isHubPickMode
            ? "pb-[calc(1rem+env(safe-area-inset-bottom))]"
            : "pb-[calc(5.5rem+env(safe-area-inset-bottom))]",
        )}
      >
        {cityHubOnly && selectedIntent == null ? (
          <div className="px-4 pb-2 pt-3">
            <MobileLocationPanel
              variant="cityHub"
              citySlug={citySlug}
              selectedCitySlug={pendingCitySlug}
              onCityPick={(slug) => setPendingCitySlug(slug)}
              searchText={searchText}
              onSearchTextChange={setSearchText}
              onClose={() => {}}
              draft={sheetDraft}
              setDraft={patchSheetDraft}
              actions={sheetActions}
              apiOptions={safeApiOptions}
            />
          </div>
        ) : null}
        <MobileSearch
          searchText={searchText}
          onSearchTextChange={setSearchText}
          selectedIntent={selectedIntent}
          onIntentSelect={handleIntentSelect}
          onResultNavigate={handleSearchResultNavigate}
          filtersSection={
            <>
              {renderAccordion(
                "location",
                "Где",
                getLocationText(),
                <div className="p-0">
                  <MobileLocationPanel
                    variant="default"
                    citySlug={pendingCitySlug}
                    selectedCitySlug={pendingCitySlug}
                    onCityPick={(slug) => setPendingCitySlug(slug)}
                    searchText={searchText}
                    onSearchTextChange={setSearchText}
                    onClose={() => {}}
                    draft={sheetDraft}
                    setDraft={patchSheetDraft}
                    actions={sheetActions}
                    apiOptions={safeApiOptions}
                  />
                </div>,
              )}
              {renderAccordion(
                "date",
                "Когда",
                getDateText(),
                <div className="p-4">
                  <DatePanel
                    onClose={() => {}}
                    applied={sheetDraft}
                    actions={sheetActions}
                  />
                </div>,
              )}
              {renderAccordion(
                "age",
                "С кем",
                whoPrimaryLine,
                <div className="p-0">
                  <AgePanel
                    embedded
                    onClose={() => {}}
                    applied={sheetDraft}
                    actions={ageSheetActions}
                    selectedChildIds={childrenScope.selectedChildrenIds}
                    selectedPersonaIds={family?.selectedPersonaIds ?? []}
                    availableChildren={showChildrenPreset ? profileChildren : []}
                    onToggleChild={showChildrenPreset ? toggleChild : undefined}
                    primaryAdult={
                      family?.personas?.[0]?.kind === "adult" && family.personas[0].isProfileComplete === true
                        ? {
                            id: family.personas[0].id,
                            displayName: family.personas[0].displayName,
                            birthDate: family.personas[0].birthDate ?? undefined,
                            isProfileComplete: family.personas[0].isProfileComplete,
                          }
                        : null
                    }
                    adultSelected={adultSelected}
                    onToggleAdult={
                      family
                        ? toggleAdult
                        : undefined
                    }
                    ageMode={ageMode}
                    autoAgeValues={childrenScope.autoAgeValues}
                    personaPickAtLimit={
                      !!family &&
                      family.selectedPersonaIds.length >= MAX_ACTIVE_FAMILY_PERSONAS
                    }
                    whoFreeMode={ageMode === "free"}
                    onSelectEveryone={
                      family
                        ? handleSelectFreeMode
                        : undefined
                    }
                  />
                </div>,
              )}
            </>
          }
        />
      </div>

      <div
        className={cn(
          "sticky bottom-0 z-10 shrink-0 border-t border-gray-100 bg-white/95 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] backdrop-blur supports-[backdrop-filter]:bg-white/90",
          isHubPickMode && "hidden",
        )}
      >
        <div className="flex items-center gap-3">
          {searchFlowMode === "wizard" && activeSection === "date" ? (
            <button
              type="button"
              onClick={goNextGuided}
              className="shrink-0 rounded-xl px-3 py-3.5 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900 active:bg-gray-200"
            >
              Пропустить
            </button>
          ) : showLeftReset ? (
            <button
              type="button"
              onClick={handleResetAll}
              className="shrink-0 rounded-xl px-3 py-3.5 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900 active:bg-gray-200"
            >
              Сбросить
            </button>
          ) : (
            <div className="w-[5.5rem] shrink-0" aria-hidden />
          )}
          <div className="min-w-0 flex-1" />
          <button
            type="button"
            onClick={handleBottomPrimaryClick}
            className="min-w-[10rem] shrink-0 rounded-xl bg-[#EF8759] px-5 py-3.5 text-[15px] font-semibold text-white transition-colors hover:bg-[#e67c4f] active:scale-[0.98]"
          >
            {bottomPrimaryLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
