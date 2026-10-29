"use client";

import { Clock3 } from "lucide-react";
import type { LastPublicSearchResult } from "@/lib/search/recentPublicSearch";

const RESULT_TYPES: Record<LastPublicSearchResult["type"], string> = {
  activity: "Событие",
  offer: "Предложение",
  place: "Место",
  route: "Маршрут",
  article: "Статья",
};

/** Unified single-entry last search. Prefer the last visited page over a search-term chip. */
export function LastSearchEntry({
  result,
  fallbackQuery,
  onNavigate,
  onQueryPick,
}: {
  result: LastPublicSearchResult | null;
  fallbackQuery: string | null;
  onNavigate: (url: string) => void;
  onQueryPick: (query: string) => void;
}) {
  if (!result && !fallbackQuery) return null;

  return (
    <section aria-label="Последний поиск">
      <p className="mb-3 text-xs font-medium uppercase tracking-wide text-neutral-400">
        Последний поиск
      </p>
      {result ? (
        <button
          type="button"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => onNavigate(result.url)}
          className="flex w-full items-start gap-2.5 rounded-xl bg-neutral-50/70 px-3 py-3 text-left text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-700"
          title={result.title}
        >
          <Clock3 className="mt-0.5 h-4 w-4 shrink-0 text-neutral-400" aria-hidden />
          <span className="min-w-0 flex-1">
            <span className="block line-clamp-2 text-sm font-medium leading-snug">{result.title}</span>
            <span className="mt-1 block truncate text-xs text-neutral-400">
              {RESULT_TYPES[result.type]} · «{result.query}»
            </span>
          </span>
        </button>
      ) : (
        <button
          type="button"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => onQueryPick(fallbackQuery!)}
          title={fallbackQuery!}
          className="max-w-full truncate rounded-full border border-neutral-200 bg-neutral-50 px-3 py-1.5 text-left text-sm text-neutral-600 transition-colors hover:bg-neutral-100"
        >
          {fallbackQuery}
        </button>
      )}
    </section>
  );
}
