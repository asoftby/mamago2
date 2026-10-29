"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { EventCard, EVENT_LISTING_IMAGE_SIZES, activityMockToEventCard } from "@/components/events";
import { AnalyticsCardViewTracker } from "@/components/analytics/AnalyticsCardViewTracker";
import { OrderedMasonryGrid } from "@/components/ideas/OrderedMasonryGrid";
import { resolvePosterFrame } from "@/lib/media/posterFrame";
import {
  buildNextPageParams,
  listingPageHref,
  type FeedBucket,
  type KudaListingPage,
} from "@/lib/discovery/kudaListingPagination";
import type { ActivityMock } from "@/types/activity";
import type { ImplicitListingFilters } from "@/features/filters/discovery/discoveryFilterParams";

export type KudaListingItem = ActivityMock & { feedBucket: FeedBucket };

export type KudaListingProps = Omit<KudaListingPage<ActivityMock>, "items"> & {
  items: KudaListingItem[];
  /** Server-side filter signature of this render (see discoveryFiltersSignature). */
  filtersSignature: string;
};

type StoredListing = {
  items: KudaListingItem[];
  lastPage: number;
  totalPages: number;
  scrollY: number;
  savedAt: number;
};

const STORE_PREFIX = "mamago:kuda-listing:";
const STORE_TTL_MS = 30 * 60 * 1000;
/** Eager/high-priority covers: the first row(s) on phones and desktop. */
const PRIORITY_COUNT = 4;

function readStored(key: string): StoredListing | null {
  try {
    const raw = window.sessionStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredListing;
    if (!Array.isArray(parsed.items) || Date.now() - parsed.savedAt > STORE_TTL_MS) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeStored(key: string, value: StoredListing) {
  try {
    window.sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Quota / private mode: restoring is best-effort.
  }
}

function isBackForwardNavigation(): boolean {
  try {
    const entry = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
    if (entry?.type === "back_forward") return true;
  } catch {
    // ignore
  }
  // App Router soft back navigation: the history entry carries our marker.
  return Boolean((window.history.state as { __kudaListing?: boolean } | null)?.__kudaListing);
}

/**
 * Afisha («Куда пойти») listing: SSR'd `?page=N` portion + infinite scroll.
 *
 * - SSR renders exactly the requested page (indexable, see CityShell). The
 *   client appends next pages from `/api/discovery/events/page` to the same
 *   masonry; already shown cards never move (OrderedMasonryGrid append mode).
 * - Back from an event: loaded pages, column assignment and scroll position
 *   are restored from sessionStorage (keyed by the listing URL).
 * - The «Популярное у других семей» layer keeps its position after all
 *   primary results; when it starts, it gets its own heading + masonry.
 */
export function KudaMasonryListing({
  listing,
  citySlug,
  filterSummary,
  implicitFilters,
}: {
  listing: KudaListingProps;
  citySlug: string;
  filterSummary: string;
  /** Route-implied filters (category hub) — must reach every next-page request. */
  implicitFilters?: ImplicitListingFilters;
}) {
  const pathname = usePathname();
  const query = useSearchParams().toString();
  const storeKey = `${STORE_PREFIX}${pathname}?${query}`;
  const [items, setItems] = useState<KudaListingItem[]>(listing.items);
  const [lastPage, setLastPage] = useState(listing.page);
  const [totalPages, setTotalPages] = useState(listing.totalPages);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const restoredRef = useRef(false);
  const pendingScrollRef = useRef<number | null>(null);

  // Server render changed (filters / page) → start over from it.
  const listingKey = `${listing.filtersSignature}|${listing.page}|${listing.items.map((item) => item.id).join(",")}`;
  const lastListingKeyRef = useRef(listingKey);
  useLayoutEffect(() => {
    if (lastListingKeyRef.current === listingKey) return;
    lastListingKeyRef.current = listingKey;
    setItems(listing.items);
    setLastPage(listing.page);
    setTotalPages(listing.totalPages);
    setFailed(false);
  }, [listingKey, listing.items, listing.page, listing.totalPages]);

  // Restore loaded pages + scroll on back navigation (before paint).
  useLayoutEffect(() => {
    if (restoredRef.current) return;
    restoredRef.current = true;
    const stored = readStored(storeKey);
    if (!stored || !isBackForwardNavigation()) return;
    const firstIds = listing.items.map((item) => item.id).join(",");
    const storedFirst = stored.items.slice(0, listing.items.length).map((item) => item.id).join(",");
    // Same server page and the same leading items → the stored pages still apply.
    if (firstIds !== storedFirst) return;
    setItems(stored.items);
    setLastPage(stored.lastPage);
    setTotalPages(stored.totalPages);
    pendingScrollRef.current = stored.scrollY;
  }, [storeKey, listing.items]);

  useLayoutEffect(() => {
    if (pendingScrollRef.current == null) return;
    const y = pendingScrollRef.current;
    pendingScrollRef.current = null;
    window.scrollTo(0, y);
  }, [items]);

  // Persist loaded pages + scroll; mark the history entry for soft back nav.
  const snapshotRef = useRef<StoredListing | null>(null);
  snapshotRef.current = { items, lastPage, totalPages, scrollY: 0, savedAt: 0 };
  useEffect(() => {
    const save = () => {
      const snapshot = snapshotRef.current;
      if (!snapshot) return;
      writeStored(storeKey, { ...snapshot, scrollY: window.scrollY, savedAt: Date.now() });
    };
    try {
      const state = (window.history.state ?? {}) as Record<string, unknown>;
      if (!state.__kudaListing) window.history.replaceState({ ...state, __kudaListing: true }, "");
    } catch {
      // ignore
    }
    let frame = 0;
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(save);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("pagehide", save);
    document.addEventListener("click", save, true);
    return () => {
      cancelAnimationFrame(frame);
      save();
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("pagehide", save);
      document.removeEventListener("click", save, true);
    };
  }, [storeKey]);

  const hasMore = lastPage < totalPages;

  const loadNext = useCallback(async () => {
    if (loading || !hasMore) return;
    setLoading(true);
    setFailed(false);
    try {
      const params = buildNextPageParams(window.location.search, {
        page: lastPage + 1,
        citySlug,
        implicitFilters,
      });
      const response = await fetch(`/api/discovery/events/page?${params.toString()}`, {
        credentials: "include",
        cache: "no-store",
      });
      if (!response.ok) throw new Error(String(response.status));
      const data = (await response.json()) as { page: number; totalPages: number; items: KudaListingItem[] };
      setItems((previous) => {
        const seen = new Set(previous.map((item) => item.id));
        return [...previous, ...data.items.filter((item) => !seen.has(item.id))];
      });
      setLastPage(data.page);
      setTotalPages(data.totalPages);
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, [loading, hasMore, lastPage, citySlug, implicitFilters]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !hasMore || failed || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) void loadNext();
      },
      { rootMargin: "1200px 0px" },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, failed, loadNext]);

  const primary = useMemo(() => items.filter((item) => item.feedBucket === "primary"), [items]);
  const secondary = useMemo(() => items.filter((item) => item.feedBucket === "secondary"), [items]);

  const toMasonry = (list: KudaListingItem[], positionBase: number) =>
    list.map((activity, index) => {
      const position = positionBase + index;
      const card = activityMockToEventCard(activity, citySlug);
      return {
        key: activity.id,
        ratio: resolvePosterFrame(card.imageWidth, card.imageHeight).ratio,
        content: (
          <AnalyticsCardViewTracker
            entityType={activity.analyticsEntityType ?? "EVENT"}
            entityId={activity.id}
            vertical="CITY"
            citySlug={citySlug}
            meta={{
              section: "afisha",
              position,
              filterSummary,
              feedBucket: activity.feedBucket,
              format: activity.format ?? null,
              ageFrom: activity.ageFrom,
              ageTo: activity.ageTo,
              priceMin: activity.priceMin ?? null,
              priceMax: activity.priceMax ?? null,
              discoveryIntent: activity.discoveryIntent ?? null,
            }}
          >
            <EventCard
              {...card}
              framing="poster"
              imageSizes={EVENT_LISTING_IMAGE_SIZES}
              imagePriority={activity.feedBucket === "primary" && position <= PRIORITY_COUNT}
            />
          </AnalyticsCardViewTracker>
        ),
      };
    });

  const nextHref = listingPageHref(pathname, query, lastPage + 1);
  const prevHref = listing.page > 1 ? listingPageHref(pathname, query, listing.page - 1) : null;

  return (
    <div className="space-y-8">
      {primary.length > 0 ? (
        <OrderedMasonryGrid
          items={toMasonry(primary, listing.offset)}
          persistKey={`${storeKey}:primary`}
        />
      ) : null}

      {secondary.length > 0 && listing.secondaryHeading ? (
        <div className="space-y-4">
          <h2 className="px-1 text-[15px] font-semibold text-muted-foreground">{listing.secondaryHeading}</h2>
          <OrderedMasonryGrid
            items={toMasonry(secondary, listing.offset + primary.length)}
            persistKey={`${storeKey}:secondary`}
          />
        </div>
      ) : null}

      <div ref={sentinelRef} aria-hidden className="h-px" />

      {/* Crawlable pagination; also the manual fallback when auto-loading fails. */}
      <nav aria-label="Страницы афиши" className="flex items-center justify-center gap-3 pb-4">
        {prevHref ? (
          <Link
            href={prevHref}
            rel="prev"
            className="rounded-full border border-border px-4 py-2 text-sm font-medium hover:border-foreground/40"
          >
            ← Предыдущие
          </Link>
        ) : null}
        {hasMore ? (
          <a
            href={nextHref}
            rel="next"
            onClick={(event) => {
              event.preventDefault();
              void loadNext();
            }}
            aria-busy={loading}
            className="rounded-full border border-border px-4 py-2 text-sm font-medium hover:border-foreground/40"
          >
            {loading ? "Загружаем…" : failed ? "Повторить загрузку" : "Показать ещё"}
          </a>
        ) : null}
      </nav>
    </div>
  );
}
