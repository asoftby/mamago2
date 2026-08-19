"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { MobileSearchHeroRow } from "@/components/mobile/MobileSearchHeroRow";
import { ComingSoonBadge } from "@/components/city/ComingSoonBadge";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { DISCOVERY_INTENT_ITEMS } from "@/lib/discovery/discoveryIntentConfig";
import { SearchResults } from "@/components/search/SearchResults";
import type { SearchResultItem as SearchResultItemType } from "@/lib/search/types";
import {
  PUBLIC_SEARCH_DEBOUNCE_MS,
  PUBLIC_SEARCH_RESULTS_LIMIT,
} from "@/lib/search/constants";
import { resolveVisiblePopularTags } from "@/lib/search/popularSearchTags";
import { rememberPublicSearchQuery } from "@/lib/search/recentPublicSearch";
import { useLastPublicSearchQuery } from "@/hooks/useLastPublicSearchQuery";

export type MobileSearchState = "idle" | "focused" | "typing";

export type MobileSearchProps = {
  searchText: string;
  onSearchTextChange: (value: string) => void;
  selectedIntent: string | null;
  onIntentSelect: (intentId: string) => void;
  /** Аккордеон «Где / Когда / С кем» — только когда выбран раздел и запрос короче 2 символов */
  filtersSection: ReactNode;
  onResultNavigate: (item: SearchResultItemType) => void;
};

export function MobileSearch({
  searchText,
  onSearchTextChange,
  selectedIntent,
  onIntentSelect,
  filtersSection,
  onResultNavigate,
}: MobileSearchProps) {
  const lastSearch = useLastPublicSearchQuery();
  const inputRef = useRef<HTMLInputElement>(null);
  const tabsRef = useRef<(HTMLElement | null)[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const [inputFocused, setInputFocused] = useState(false);
  const [indicatorStyle, setIndicatorStyle] = useState({ left: 0, width: 0 });
  const [results, setResults] = useState<SearchResultItemType[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  const queryTrim = searchText.trim();
  const debouncedRaw = useDebouncedValue(searchText, PUBLIC_SEARCH_DEBOUNCE_MS);
  const trimmed = debouncedRaw.trim();
  const debouncing = queryTrim.length >= 2 && queryTrim !== trimmed;

  const searchState: MobileSearchState = useMemo(() => {
    if (queryTrim.length >= 2) return "typing";
    if (inputFocused) return "focused";
    return "idle";
  }, [queryTrim.length, inputFocused]);

  /** Фильтры показываем только при выбранном разделе и без длинного запроса (чтобы не дублировать с автодополнением). */
  const showFiltersSection =
    selectedIntent != null && queryTrim.length < 2;
  const selectedIntentEnabled = DISCOVERY_INTENT_ITEMS.some(
    (item) => item.id === selectedIntent && item.navigationEnabled,
  );

  useLayoutEffect(() => {
    if (selectedIntent == null) {
      setIndicatorStyle({ left: 0, width: 0 });
      return;
    }
    const intentTabIndex = DISCOVERY_INTENT_ITEMS.findIndex(
      (item) => item.id === selectedIntent,
    );
    const currentTab = tabsRef.current[intentTabIndex];
    if (currentTab && containerRef.current) {
      setIndicatorStyle({
        left: currentTab.offsetLeft,
        width: currentTab.clientWidth,
      });
    }
  }, [selectedIntent]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (selectedIntent == null) return;
      const intentTabIndex = DISCOVERY_INTENT_ITEMS.findIndex(
        (item) => item.id === selectedIntent,
      );
      const currentTab = tabsRef.current[intentTabIndex];
      if (currentTab && containerRef.current) {
        setIndicatorStyle({
          left: currentTab.offsetLeft,
          width: currentTab.clientWidth,
        });
      }
    }, 50);
    return () => clearTimeout(timer);
  }, [selectedIntent]);

  useEffect(() => {
    if (trimmed.length < 2) {
      setResults([]);
      setLoading(false);
      setActiveIndex(-1);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setActiveIndex(-1);
    (async () => {
      try {
        const res = await fetch(
          `/api/search?q=${encodeURIComponent(trimmed)}&limit=${PUBLIC_SEARCH_RESULTS_LIMIT}`,
          { credentials: "include", cache: "no-store" },
        );
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as { results?: SearchResultItemType[] };
        if (!cancelled) {
          setResults(Array.isArray(data.results) ? data.results : []);
        }
      } catch {
        if (!cancelled) setResults([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [trimmed]);

  const handlePopularPick = useCallback(
    (term: string) => {
      onSearchTextChange(term);
      requestAnimationFrame(() => {
        inputRef.current?.focus();
      });
    },
    [onSearchTextChange],
  );

  const handleSelectResult = useCallback(
    (item: SearchResultItemType) => {
      const q = searchText.trim();
      if (q.length >= 2) rememberPublicSearchQuery(q);
      onResultNavigate(item);
    },
    [searchText, onResultNavigate],
  );

  /** Как в разделах discovery: табы видны в idle даже до выбора раздела (хаб города). */
  const showIntentRow = searchState === "idle";

  const showPopularBlock =
    searchState === "focused" && queryTrim.length < 2;
  // Counts are not wired from SearchQueryLog yet → empty until threshold (≥20) can be met.
  const popularTags = resolveVisiblePopularTags();
  const showPopularHints =
    showPopularBlock && (Boolean(lastSearch) || popularTags.length > 0);

  const showAutocomplete =
    searchState === "typing" && queryTrim.length >= 2;

  useEffect(() => {
    if (!showAutocomplete) return;
    const onKey = (e: KeyboardEvent) => {
      if (results.length === 0 || trimmed.length < 2) return;
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIndex((i) =>
          i < 0 ? 0 : Math.min(i + 1, results.length - 1),
        );
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIndex((i) => (i <= 0 ? -1 : i - 1));
      } else if (e.key === "Enter" && activeIndex >= 0 && results[activeIndex]) {
        e.preventDefault();
        handleSelectResult(results[activeIndex]);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [showAutocomplete, results, trimmed, activeIndex, handleSelectResult]);

  useEffect(() => {
    if (results.length > 0 && activeIndex >= results.length) {
      setActiveIndex(results.length - 1);
    }
  }, [results, activeIndex]);

  return (
    <div
      className={cn(
        showAutocomplete
          ? "flex min-h-0 flex-1 flex-col"
          : "space-y-0",
      )}
    >
      <div className="shrink-0 px-4 pb-3 pt-2">
        <MobileSearchHeroRow
          value={searchText}
          onChange={onSearchTextChange}
          inputRef={inputRef}
          onFocus={() => setInputFocused(true)}
          onBlur={() => setInputFocused(false)}
          loading={(loading || debouncing) && queryTrim.length >= 2}
        />
      </div>

      {showAutocomplete ? (
        <div className="flex min-h-0 flex-1 flex-col px-4 pb-2">
          <SearchResults
            variant="sheet"
            query={searchText}
            trimmedQuery={queryTrim}
            loading={loading || debouncing}
            results={results}
            activeIndex={activeIndex}
            onPopularPick={handlePopularPick}
            onSelectResult={handleSelectResult}
          />
        </div>
      ) : (
        <>
          {showIntentRow ? (
            <div className="border-b border-gray-100 py-4">
              <div
                ref={containerRef}
                className="relative grid grid-cols-4 px-2"
              >
                {DISCOVERY_INTENT_ITEMS.map((intentConfig, index) => {
                  const isActive =
                    intentConfig.navigationEnabled &&
                    selectedIntent != null &&
                    intentConfig.id === selectedIntent;
                  const content = (
                    <>
                      {intentConfig.image ? (
                        <div className="relative flex h-9 w-9 items-center justify-center">
                          <Image
                            src={intentConfig.image}
                            alt=""
                            width={36}
                            height={36}
                            className={cn(
                              "object-contain transition-all duration-200",
                              isActive ? "scale-100" : "scale-90 opacity-60",
                            )}
                          />
                        </div>
                      ) : (
                        <div className="h-9 w-9 rounded-full bg-gray-200" />
                      )}
                      <span className="flex min-w-0 flex-col items-center gap-1">
                        <span
                          className={cn(
                            "whitespace-nowrap text-center text-[11px] font-medium leading-tight transition-all duration-200 min-[375px]:text-xs",
                            isActive
                              ? "font-semibold text-gray-900"
                              : "text-gray-400",
                          )}
                        >
                          {intentConfig.label}
                        </span>
                        {!intentConfig.navigationEnabled && intentConfig.comingSoon ? (
                          <ComingSoonBadge className="px-1 py-0 text-[9px]" />
                        ) : null}
                      </span>
                    </>
                  );

                  return intentConfig.navigationEnabled ? (
                    <button
                      key={intentConfig.id}
                      type="button"
                      ref={(el) => {
                        tabsRef.current[index] = el;
                      }}
                      onClick={() => onIntentSelect(intentConfig.id)}
                      className={cn(
                        "flex min-w-0 cursor-pointer flex-col items-center gap-2 rounded-xl px-1 py-2 transition-all duration-200",
                        isActive
                          ? "text-gray-900"
                          : "text-gray-500 hover:bg-gray-50 hover:text-gray-700 active:scale-95",
                      )}
                    >
                      {content}
                    </button>
                  ) : (
                    <span
                      key={intentConfig.id}
                      ref={(el) => {
                        tabsRef.current[index] = el;
                      }}
                      role="link"
                      aria-disabled="true"
                      tabIndex={-1}
                      className="flex min-w-0 cursor-default flex-col items-center gap-2 rounded-xl px-1 py-2 text-gray-400"
                    >
                      {content}
                    </span>
                  );
                })}
                <div
                  className="absolute bottom-0 h-[3px] rounded-full bg-[#EF8759] transition-all duration-300 ease-out"
                  style={{
                    left: `${indicatorStyle.left}px`,
                    width: `${indicatorStyle.width}px`,
                    opacity: selectedIntentEnabled ? 1 : 0,
                  }}
                />
              </div>
            </div>
          ) : null}

          {showPopularHints ? (
            <div
              className={cn(
                "animate-in fade-in slide-in-from-top-1 px-4 pb-4 duration-200",
              )}
            >
              {lastSearch ? (
                <>
                  <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-neutral-500">
                    Последний поиск
                  </p>
                  <ul className={cn("flex flex-wrap gap-2", popularTags.length > 0 && "mb-5")}>
                    <li className="max-w-full">
                      <button
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => handlePopularPick(lastSearch)}
                        className="max-w-full truncate rounded-full border border-neutral-200 bg-neutral-50 px-3.5 py-2 text-left text-sm font-medium text-neutral-800 transition-colors hover:border-border-brand-soft hover:bg-brand-soft active:scale-[0.98]"
                        title={lastSearch}
                      >
                        {lastSearch}
                      </button>
                    </li>
                  </ul>
                </>
              ) : null}
              {popularTags.length > 0 ? (
                <>
                  <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-neutral-500">
                    Популярное
                  </p>
                  <ul className="flex flex-wrap gap-2">
                    {popularTags.map((term) => (
                      <li key={term}>
                        <button
                          type="button"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => handlePopularPick(term)}
                          className="rounded-full border border-neutral-200 bg-neutral-50 px-3.5 py-2 text-sm font-medium text-neutral-800 transition-colors hover:border-border-brand-soft hover:bg-brand-soft active:scale-[0.98]"
                        >
                          {term}
                        </button>
                      </li>
                    ))}
                  </ul>
                </>
              ) : null}
            </div>
          ) : null}

          {showFiltersSection ? (
            <div className="space-y-3 bg-white p-4 pt-1">{filtersSection}</div>
          ) : null}
        </>
      )}
    </div>
  );
}
