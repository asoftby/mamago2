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
import { X, ChevronDown } from "lucide-react";
import Image from "next/image";
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
  DISCOVERY_INTENT_ITEMS,
} from "@/lib/discovery/discoveryIntentConfig";
import { AGE_GROUPS } from "@/features/filters/age/ageGroups";
import { getCityLocativePhrase } from "@/lib/city/cityDisplayNames";

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
  const [indicatorStyle, setIndicatorStyle] = useState<{
    left: number;
    width: number;
  }>({ left: 0, width: 0 });
  const tabsRef = useRef<(HTMLButtonElement | null)[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const prevIsOpenRef = useRef(false);
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
    if (selectedIntent == null) {
      setIndicatorStyle({ left: 0, width: 0 });
      return;
    }
    const activeIndex = DISCOVERY_INTENT_ITEMS.findIndex(
      (item) => item.id === selectedIntent,
    );
    const currentTab = tabsRef.current[activeIndex];
    if (currentTab && containerRef.current) {
      setIndicatorStyle({
        left: currentTab.offsetLeft,
        width: currentTab.clientWidth,
      });
    }
  }, [selectedIntent]);

  useEffect(() => {
    if (!isOpen || selectedIntent == null) return;
    const timer = setTimeout(() => {
      const activeIndex = DISCOVERY_INTENT_ITEMS.findIndex(
        (item) => item.id === selectedIntent,
      );
      const currentTab = tabsRef.current[activeIndex];
      if (currentTab && containerRef.current) {
        setIndicatorStyle({
          left: currentTab.offsetLeft,
          width: currentTab.clientWidth,
        });
      }
    }, 50);
    return () => clearTimeout(timer);
  }, [isOpen, selectedIntent]);

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
    const items: string[] = [];
    items.push(getCityLocativePhrase(pendingCitySlug));
    if (sheetDraft.nearby) items.push("Поблизости");
    if (sheetDraft.metro) {
      const metro = safeApiOptions.metros.find(
        (m) => m.value === sheetDraft.metro,
      );
      if (metro) items.push(metro.label);
    }
    if (sheetDraft.district) {
      const district = safeApiOptions.districts.find(
        (d) => d.value === sheetDraft.district,
      );
      if (district) items.push(district.label);
    }
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

  const getAgeText = useCallback(() => {
    if (sheetDraft.age.length === 0) return "Выберите возраст";
    const ageLabels = sheetDraft.age.map((ageValue) => {
      const group = AGE_GROUPS.find((g) => g.value === ageValue);
      return group ? group.label : ageValue;
    });
    if (ageLabels.length === 1) return ageLabels[0];
    if (ageLabels.length === 2) return `${ageLabels[0]}, ${ageLabels[1]}`;
    return `${ageLabels[0]} +${ageLabels.length - 1}`;
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

  /** После «Далее» подводим начало следующей карточки к верху прокручиваемой области */
  useLayoutEffect(() => {
    if (!isOpen || isHubPickMode) return;
    if (!activeSection) return;
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
          <button
            type="button"
            onClick={handleSheetClose}
            className="-ml-2 rounded-full p-2 transition-colors hover:bg-gray-100"
            aria-label="Закрыть"
          >
            <X className="h-6 w-6 text-gray-600" />
          </button>
          <h2 className="text-lg font-semibold text-gray-900">Поиск</h2>
          <div className="w-10" />
        </div>
      </div>

      <div
        className={cn(
          "min-h-0 flex-1 overflow-y-auto",
          isHubPickMode
            ? "pb-[calc(1rem+env(safe-area-inset-bottom))]"
            : "pb-[calc(5.5rem+env(safe-area-inset-bottom))]",
        )}
      >
        {isHubPickMode ? (
          <>
            <div className="px-4 pb-2 pt-4">
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
            <div className="border-b border-gray-100 py-4">
              <div
                ref={containerRef}
                className="relative flex gap-4 overflow-x-auto px-4 no-scrollbar"
              >
                {DISCOVERY_INTENT_ITEMS.map((intentConfig, index) => {
                  const isActive = intentConfig.id === selectedIntent;
                  return (
                    <button
                      key={intentConfig.id}
                      type="button"
                      ref={(el) => {
                        tabsRef.current[index] = el;
                      }}
                      onClick={() => handleIntentSelect(intentConfig.id)}
                      className={cn(
                        "flex min-w-[80px] flex-col items-center gap-2 rounded-xl p-3 transition-all duration-200",
                        isActive
                          ? "text-gray-900"
                          : "text-gray-500 hover:bg-gray-50 hover:text-gray-700 active:scale-95",
                      )}
                    >
                      {intentConfig.image ? (
                        <div className="relative flex h-8 w-8 items-center justify-center">
                          <Image
                            src={intentConfig.image}
                            alt={intentConfig.label}
                            width={32}
                            height={32}
                            className={cn(
                              "object-contain transition-all duration-200",
                              isActive ? "scale-100" : "scale-90 opacity-80",
                            )}
                          />
                        </div>
                      ) : (
                        <div className="h-8 w-8 rounded-full bg-gray-200" />
                      )}
                      <span
                        className={cn(
                          "text-center text-xs font-medium leading-tight transition-all duration-200",
                          isActive
                            ? "font-semibold text-gray-900"
                            : "text-gray-500",
                        )}
                      >
                        {intentConfig.label}
                      </span>
                    </button>
                  );
                })}
                <div
                  className="absolute bottom-0 h-[3px] rounded-full bg-[#EF8759] transition-all duration-300 ease-out"
                  style={{
                    left: `${indicatorStyle.left}px`,
                    width: `${indicatorStyle.width}px`,
                    opacity: selectedIntent == null ? 0 : 1,
                  }}
                />
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="px-4 pb-2 pt-4">
              <div className="relative">
                <input
                  type="search"
                  enterKeyHint="search"
                  placeholder="Поиск мест, событий, активностей..."
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 px-4 py-3 pr-10 text-base focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[#EF8759]"
                />
                {searchText ? (
                  <button
                    type="button"
                    onClick={() => setSearchText("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 transition-colors hover:bg-gray-100"
                    aria-label="Очистить поле"
                  >
                    <X className="h-4 w-4 text-gray-400" />
                  </button>
                ) : null}
              </div>
            </div>

            <div className="border-b border-gray-100 py-4">
              <div
                ref={containerRef}
                className="relative flex gap-4 overflow-x-auto px-4 no-scrollbar"
              >
                {DISCOVERY_INTENT_ITEMS.map((intentConfig, index) => {
                  const isActive = intentConfig.id === selectedIntent;
                  return (
                    <button
                      key={intentConfig.id}
                      type="button"
                      ref={(el) => {
                        tabsRef.current[index] = el;
                      }}
                      onClick={() => handleIntentSelect(intentConfig.id)}
                      className={cn(
                        "flex min-w-[80px] flex-col items-center gap-2 rounded-xl p-3 transition-all duration-200",
                        isActive
                          ? "text-gray-900"
                          : "text-gray-500 hover:bg-gray-50 hover:text-gray-700 active:scale-95",
                      )}
                    >
                      {intentConfig.image ? (
                        <div className="relative flex h-8 w-8 items-center justify-center">
                          <Image
                            src={intentConfig.image}
                            alt={intentConfig.label}
                            width={32}
                            height={32}
                            className={cn(
                              "object-contain transition-all duration-200",
                              isActive ? "scale-100" : "scale-90 opacity-80",
                            )}
                          />
                        </div>
                      ) : (
                        <div className="h-8 w-8 rounded-full bg-gray-200" />
                      )}
                      <span
                        className={cn(
                          "text-center text-xs font-medium leading-tight transition-all duration-200",
                          isActive
                            ? "font-semibold text-gray-900"
                            : "text-gray-500",
                        )}
                      >
                        {intentConfig.label}
                      </span>
                    </button>
                  );
                })}
                <div
                  className="absolute bottom-0 h-[3px] rounded-full bg-[#EF8759] transition-all duration-300 ease-out"
                  style={{
                    left: `${indicatorStyle.left}px`,
                    width: `${indicatorStyle.width}px`,
                    opacity: selectedIntent == null ? 0 : 1,
                  }}
                />
              </div>
            </div>

            <div className="space-y-3 p-4">
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
                getAgeText(),
                <div className="p-0">
                  <AgePanel
                    embedded
                    onClose={() => {}}
                    applied={sheetDraft}
                    actions={sheetActions}
                  />
                </div>,
              )}
            </div>
          </>
        )}
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
