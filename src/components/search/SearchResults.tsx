"use client";

import { cn } from "@/lib/utils";
import { useLastPublicSearchQuery } from "@/hooks/useLastPublicSearchQuery";
import type { SearchResultItem as SearchResultItemType } from "@/lib/search/types";
import { resolveVisiblePopularTags } from "@/lib/search/popularSearchTags";
import { SearchResultItem } from "./SearchResultItem";

function SkeletonRows() {
  return (
    <div className="space-y-2 px-1 py-2">
      {Array.from({ length: 6 }, (_, i) => (
        <div
          key={i}
          className="flex gap-3 rounded-xl px-3 py-2.5"
        >
          <div className="h-12 w-12 shrink-0 animate-pulse rounded-lg bg-neutral-200" />
          <div className="flex-1 space-y-2 pt-0.5">
            <div className="h-4 max-w-[75%] animate-pulse rounded bg-neutral-200" />
            <div className="h-3 w-1/4 animate-pulse rounded bg-neutral-200" />
            <div className="h-3 w-1/2 animate-pulse rounded bg-neutral-200" />
          </div>
        </div>
      ))}
    </div>
  );
}

function PopularTagsBlock({
  tags,
  onPopularPick,
  centered = false,
}: {
  tags: string[];
  onPopularPick: (term: string) => void;
  centered?: boolean;
}) {
  if (tags.length === 0) return null;

  return (
    <div className={centered ? "mt-6" : undefined}>
      <p className="mb-3 text-xs font-medium uppercase tracking-wide text-neutral-400">
        Популярное
      </p>
      <ul className={cn("flex flex-wrap gap-2", centered && "justify-center")}>
        {tags.map((term) => (
          <li key={term}>
            <button
              type="button"
              onClick={() => onPopularPick(term)}
              className="rounded-full border border-neutral-200 bg-neutral-50 px-3 py-1.5 text-sm text-neutral-700 transition-colors hover:bg-neutral-100"
            >
              {term}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function SearchResults({
  query,
  trimmedQuery,
  loading,
  results,
  activeIndex,
  onPopularPick,
  onSelectResult,
  variant = "overlay",
}: {
  query: string;
  trimmedQuery: string;
  loading: boolean;
  results: SearchResultItemType[];
  activeIndex: number;
  onPopularPick: (term: string) => void;
  onSelectResult: (item: SearchResultItemType) => void;
  /** overlay — десктопный дропдаун (ограниченная высота); sheet — fullscreen mobile */
  variant?: "overlay" | "sheet";
}) {
  const lastSearch = useLastPublicSearchQuery();
  // Counts are not wired from SearchQueryLog yet → empty until threshold can be met.
  const popularTags = resolveVisiblePopularTags();
  const showEmptyHints = trimmedQuery.length < 2;
  const showNoResults = trimmedQuery.length >= 2 && !loading && results.length === 0;
  const showEmptyPanel = showEmptyHints && (Boolean(lastSearch) || popularTags.length > 0);

  return (
    <div
      className={cn(
        "overflow-y-auto rounded-xl border border-neutral-100 bg-white/95 shadow-inner",
        variant === "sheet"
          ? "mt-0 min-h-0 flex-1"
          : "mt-3 max-h-[min(50vh,420px)]",
      )}
    >
      {showEmptyPanel ? (
        <div className="p-4">
          {lastSearch ? (
            <>
              <p className="mb-3 text-xs font-medium uppercase tracking-wide text-neutral-400">
                Последний поиск
              </p>
              <ul className={cn("flex flex-wrap gap-2", popularTags.length > 0 && "mb-5")}>
                <li className="max-w-full">
                  <button
                    type="button"
                    onClick={() => onPopularPick(lastSearch)}
                    className="max-w-full truncate rounded-full border border-neutral-200 bg-neutral-50 px-3 py-1.5 text-left text-sm text-neutral-700 transition-colors hover:bg-neutral-100"
                    title={lastSearch}
                  >
                    {lastSearch}
                  </button>
                </li>
              </ul>
            </>
          ) : null}
          <PopularTagsBlock tags={popularTags} onPopularPick={onPopularPick} />
        </div>
      ) : null}

      {trimmedQuery.length >= 2 && loading ? <SkeletonRows /> : null}

      {trimmedQuery.length >= 2 && !loading && results.length > 0 ? (
        <ul className="divide-y divide-neutral-100 p-1">
          {results.map((item, i) => (
            <li key={`${item.type}-${item.id}`}>
              <SearchResultItem
                item={item}
                query={trimmedQuery}
                active={i === activeIndex}
                onNavigate={() => onSelectResult(item)}
              />
            </li>
          ))}
        </ul>
      ) : null}

      {showNoResults ? (
        <div className="p-6 text-center">
          <p className="text-sm font-medium text-neutral-900">Ничего не найдено</p>
          <p className="mt-1 text-sm text-neutral-500">Попробуйте изменить запрос</p>
          {lastSearch ? (
            <div className="mt-6 text-left">
              <p className="mb-3 text-xs font-medium uppercase tracking-wide text-neutral-400">
                Последний поиск
              </p>
              <ul className="flex flex-wrap gap-2">
                <li className="max-w-full">
                  <button
                    type="button"
                    onClick={() => onPopularPick(lastSearch)}
                    className="max-w-full truncate rounded-full border border-neutral-200 bg-neutral-50 px-3 py-1.5 text-left text-sm text-neutral-700 transition-colors hover:bg-neutral-100"
                    title={lastSearch}
                  >
                    {lastSearch}
                  </button>
                </li>
              </ul>
            </div>
          ) : null}
          <PopularTagsBlock
            tags={popularTags}
            onPopularPick={onPopularPick}
            centered
          />
        </div>
      ) : null}
    </div>
  );
}

/** @deprecated Use resolveVisiblePopularTags() — hardcoded list is no longer rendered as-is. */
export { POPULAR_SEARCH_TAG_CANDIDATES as POPULAR } from "@/lib/search/popularSearchTags";
