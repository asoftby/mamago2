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
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { DISCOVERY_INTENT_ITEMS } from "@/lib/discovery/discoveryIntentConfig";
import { POPULAR } from "@/components/search/SearchResults";
import { SearchResultItem } from "@/components/search/SearchResultItem";
import type { SearchResultItem as SearchResultItemType } from "@/lib/search/types";

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

function SearchResultsSkeleton() {
  return (
    <div className="space-y-2 px-1 py-2">
      {Array.from({ length: 5 }, (_, i) => (
        <div key={i} className="flex gap-3 rounded-xl px-3 py-2.5">
          <div className="h-12 w-12 shrink-0 animate-pulse rounded-lg bg-neutral-200" />
          <div className="flex-1 space-y-2 pt-0.5">
            <div className="h-4 max-w-[75%] animate-pulse rounded bg-neutral-200" />
            <div className="h-3 w-1/4 animate-pulse rounded bg-neutral-200" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function MobileSearch({
  searchText,
  onSearchTextChange,
  selectedIntent,
  onIntentSelect,
  filtersSection,
  onResultNavigate,
}: MobileSearchProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const tabsRef = useRef<(HTMLButtonElement | null)[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const [inputFocused, setInputFocused] = useState(false);
  const [indicatorStyle, setIndicatorStyle] = useState({ left: 0, width: 0 });
  const [results, setResults] = useState<SearchResultItemType[]>([]);
  const [loading, setLoading] = useState(false);

  const queryTrim = searchText.trim();
  const debounced = useDebouncedValue(queryTrim, 250);
  const debouncing = queryTrim.length >= 2 && queryTrim !== debounced;

  const searchState: MobileSearchState = useMemo(() => {
    if (queryTrim.length >= 2) return "typing";
    if (inputFocused) return "focused";
    return "idle";
  }, [queryTrim.length, inputFocused]);

  /** Фильтры показываем только при выбранном разделе и без длинного запроса (чтобы не дублировать с автодополнением). */
  const showFiltersSection =
    selectedIntent != null && queryTrim.length < 2;

  useLayoutEffect(() => {
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
    const timer = setTimeout(() => {
      if (selectedIntent == null) return;
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
  }, [selectedIntent]);

  useEffect(() => {
    if (debounced.length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const res = await fetch(
          `/api/search?q=${encodeURIComponent(debounced)}&limit=10`,
          { credentials: "include" },
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
  }, [debounced]);

  const handlePopularPick = useCallback(
    (term: string) => {
      onSearchTextChange(term);
      requestAnimationFrame(() => {
        inputRef.current?.focus();
      });
    },
    [onSearchTextChange],
  );

  /** Как в разделах discovery: табы видны в idle даже до выбора раздела (хаб города). */
  const showIntentRow = searchState === "idle";

  const showPopularBlock =
    searchState === "focused" && queryTrim.length < 2;

  const showAutocomplete =
    searchState === "typing" && queryTrim.length >= 2;

  const showNoResults =
    queryTrim.length >= 2 && !loading && !debouncing && results.length === 0;

  return (
    <div className="space-y-0">
      <div className="px-4 pb-3 pt-2">
        <MobileSearchHeroRow
          value={searchText}
          onChange={onSearchTextChange}
          inputRef={inputRef}
          onFocus={() => setInputFocused(true)}
          onBlur={() => setInputFocused(false)}
        />
      </div>

      {showAutocomplete ? (
        <div className="px-4 pb-4">
          <div className="overflow-hidden rounded-2xl border border-neutral-100 bg-white shadow-sm">
            {loading || debouncing ? <SearchResultsSkeleton /> : null}
            {!loading &&
            !debouncing &&
            results.length > 0 ? (
              <ul className="divide-y divide-neutral-100 p-1">
                {results.map((item) => (
                  <li key={`${item.type}-${item.id}`}>
                    <SearchResultItem
                      item={item}
                      query={debounced}
                      onNavigate={() => onResultNavigate(item)}
                    />
                  </li>
                ))}
              </ul>
            ) : null}
            {showNoResults ? (
              <div className="px-4 py-8 text-center">
                <p className="text-sm font-medium text-neutral-900">
                  Ничего не найдено
                </p>
                <p className="mt-1 text-sm text-neutral-500">
                  Попробуйте изменить запрос
                </p>
              </div>
            ) : null}
          </div>
        </div>
      ) : (
        <>
          {showIntentRow ? (
            <div className="border-b border-gray-100 py-4">
              <div
                ref={containerRef}
                className="relative flex gap-4 overflow-x-auto px-4 no-scrollbar"
              >
                {DISCOVERY_INTENT_ITEMS.map((intentConfig, index) => {
                  const isActive =
                    selectedIntent != null &&
                    intentConfig.id === selectedIntent;
                  return (
                    <button
                      key={intentConfig.id}
                      type="button"
                      ref={(el) => {
                        tabsRef.current[index] = el;
                      }}
                      onClick={() => onIntentSelect(intentConfig.id)}
                      className={cn(
                        "flex min-w-[80px] flex-col items-center gap-2 rounded-xl p-3 transition-all duration-200",
                        isActive
                          ? "text-gray-900"
                          : "text-gray-500 hover:bg-gray-50 hover:text-gray-700 active:scale-95",
                      )}
                    >
                      {intentConfig.image ? (
                        <div className="relative flex h-9 w-9 items-center justify-center">
                          <Image
                            src={intentConfig.image}
                            alt=""
                            width={36}
                            height={36}
                            className={cn(
                              "object-contain transition-all duration-200",
                              isActive ? "scale-100" : "scale-90 opacity-80",
                            )}
                          />
                        </div>
                      ) : (
                        <div className="h-9 w-9 rounded-full bg-gray-200" />
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
          ) : null}

          {showPopularBlock ? (
            <div
              className={cn(
                "animate-in fade-in slide-in-from-top-1 px-4 pb-4 duration-200",
              )}
            >
              <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-neutral-500">
                Популярное
              </p>
              <ul className="flex flex-wrap gap-2">
                {POPULAR.map((term) => (
                  <li key={term}>
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => handlePopularPick(term)}
                      className="rounded-full border border-neutral-200 bg-neutral-50 px-3.5 py-2 text-sm font-medium text-neutral-800 transition-colors hover:border-[#EF8759]/35 hover:bg-[#EF8759]/8 active:scale-[0.98]"
                    >
                      {term}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {showFiltersSection ? (
            <div className="space-y-3 p-4 pt-1">{filtersSection}</div>
          ) : null}
        </>
      )}
    </div>
  );
}
