"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Portal } from "@/components/ui/portal";
import { cn } from "@/lib/utils";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import type { SearchResultItem as SearchResultItemType } from "@/lib/search/types";
import { SearchInput } from "./SearchInput";
import { SearchResults } from "./SearchResults";

export function SearchOverlay({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResultItemType[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);

  const debounced = useDebouncedValue(query, 250);
  const trimmed = debounced.trim();
  const queryTrim = query.trim();
  const debouncing = queryTrim.length >= 2 && queryTrim !== trimmed;

  useEffect(() => {
    if (!open) {
      setQuery("");
      setResults([]);
      setLoading(false);
      setActiveIndex(-1);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
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
          `/api/search?q=${encodeURIComponent(trimmed)}&limit=8`,
          { credentials: "include" },
        );
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as { results: SearchResultItemType[] };
        if (!cancelled) setResults(Array.isArray(data.results) ? data.results : []);
      } catch {
        if (!cancelled) setResults([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, trimmed]);

  const close = useCallback(() => {
    onOpenChange(false);
  }, [onOpenChange]);

  const navigateTo = useCallback(
    (item: SearchResultItemType) => {
      router.push(item.url);
      close();
    },
    [router, close],
  );

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        close();
        return;
      }
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
        navigateTo(results[activeIndex]);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, close, results, trimmed, activeIndex, navigateTo]);

  useEffect(() => {
    if (results.length > 0 && activeIndex >= results.length) {
      setActiveIndex(results.length - 1);
    }
  }, [results, activeIndex]);

  if (!open) return null;

  return (
    <Portal>
      <div
        className="fixed inset-0 z-[200] flex animate-in fade-in duration-200"
        role="dialog"
        aria-modal="true"
        aria-label="Поиск"
      >
        <button
          type="button"
          aria-label="Закрыть поиск"
          className="absolute inset-0 bg-black/40 backdrop-blur-md"
          onClick={close}
        />
        <div className="pointer-events-none absolute inset-0 flex justify-center px-4 pt-[18vh] sm:pt-[20vh]">
          <div
            ref={containerRef}
            className={cn(
              "pointer-events-auto relative w-full max-w-[640px] animate-in zoom-in-95 duration-200",
            )}
            onClick={(e) => e.stopPropagation()}
          >
            <SearchInput
              value={query}
              onChange={setQuery}
              loading={(loading || debouncing) && queryTrim.length >= 2}
              open={open}
            />
            <SearchResults
              query={query}
              trimmedQuery={queryTrim}
              loading={loading || debouncing}
              results={results}
              activeIndex={activeIndex}
              onPopularPick={(term) => setQuery(term)}
              onSelectResult={navigateTo}
            />
          </div>
        </div>
      </div>
    </Portal>
  );
}
