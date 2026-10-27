"use client";

import { useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import {
  MASONRY_TEXT_ESTIMATE_PX,
  SSR_MASONRY_CONFIG,
  layoutMasonry,
  masonryColumnWidth,
  masonryColumnsForWidth,
  type MasonryColumnsConfig,
  type MasonryLayout,
} from "./orderedMasonryGeometry";

export type OrderedMasonryItem = {
  key: string;
  /** height / width of the item's media box; drives deterministic placement. */
  ratio: number;
  content: ReactNode;
};

/** SSR container width estimate for the 2-column phone layout (390px viewport, 16px gutters). */
const SSR_CONTAINER_WIDTH_PX = 358;

type Inputs = Array<{ key: string; ratio: number }>;

function subscribeViewport(onChange: () => void) {
  window.addEventListener("resize", onChange);
  window.addEventListener("orientationchange", onChange);
  return () => {
    window.removeEventListener("resize", onChange);
    window.removeEventListener("orientationchange", onChange);
  };
}
const viewportColumns = () => masonryColumnsForWidth(window.innerWidth).columns;
const ssrColumns = () => SSR_MASONRY_CONFIG.columns;
const subscribeNoop = () => () => {};
const clientTrue = () => true;
const serverFalse = () => false;

function initialLayout(inputs: Inputs): MasonryLayout {
  return layoutMasonry(
    inputs.map((input) => ({ ...input, textHeight: MASONRY_TEXT_ESTIMATE_PX })),
    { ...SSR_MASONRY_CONFIG, columnWidth: masonryColumnWidth(SSR_CONTAINER_WIDTH_PX, SSR_MASONRY_CONFIG) },
  );
}

function readPersistedLayout(key: string, columns: number): MasonryLayout | null {
  try {
    const raw = window.sessionStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { columns?: unknown; columnKeys?: unknown };
    if (parsed.columns !== columns || !Array.isArray(parsed.columnKeys)) return null;
    const columnKeys = (parsed.columnKeys as unknown[]).map((keys) =>
      Array.isArray(keys) ? keys.filter((k): k is string => typeof k === "string") : [],
    );
    if (columnKeys.length !== columns) return null;
    const assignment = new Map<string, number>();
    columnKeys.forEach((keys, column) => keys.forEach((k) => assignment.set(k, column)));
    return { columns, assignment, columnKeys };
  } catch {
    return null;
  }
}

function writePersistedLayout(key: string, layout: MasonryLayout) {
  try {
    window.sessionStorage.setItem(key, JSON.stringify({ columns: layout.columns, columnKeys: layout.columnKeys }));
  } catch {
    // Storage may be unavailable (private mode); layout still works.
  }
}

/**
 * Ordered "shortest column" masonry.
 *
 * - Items are placed in feed order, each into the currently shortest column
 *   (ties → leftmost). CSS `columns` / `grid-auto-flow: dense` are never used.
 * - Deterministic: placement uses the known media ratio + text block height
 *   (estimate for SSR, then the measured median text height via ResizeObserver).
 * - Stable: appending items never moves already placed ones; only a change of
 *   the column count (2/3/4 on resize or rotation) re-lays everything out, in a
 *   layout effect, i.e. before paint (no flash).
 * - SSR renders the 2-column phone layout; on phones the hydrated layout is
 *   identical. Before hydration ≥640px viewports see a row-major grid in the
 *   same feed order (`order`), which becomes masonry on hydration.
 */
export function OrderedMasonryGrid({
  items,
  className,
  itemClassName,
  persistKey,
}: {
  items: OrderedMasonryItem[];
  className?: string;
  itemClassName?: string;
  /**
   * sessionStorage key: when set, the column assignment is saved and reused
   * on return (back navigation), so restored cards land in the same columns.
   */
  persistKey?: string;
}) {
  const inputs = useMemo<Inputs>(() => items.map(({ key, ratio }) => ({ key, ratio })), [items]);
  const [layout, setLayout] = useState<MasonryLayout>(() => initialLayout(inputs));
  const containerRef = useRef<HTMLDivElement>(null);
  const textHeightRef = useRef<number>(MASONRY_TEXT_ESTIMATE_PX);
  /** undefined = not read yet; null = nothing (or no longer) to restore. */
  const storedRef = useRef<MasonryLayout | null | undefined>(undefined);

  // Viewport → column config (external store: server snapshot = 2 columns,
  // so hydration matches SSR and the client value applies right after).
  const columns = useSyncExternalStore(subscribeViewport, viewportColumns, ssrColumns);
  const hydrated = useSyncExternalStore(subscribeNoop, clientTrue, serverFalse);
  const config = useMemo<MasonryColumnsConfig>(
    () => masonryColumnsForWidth(columns === 4 ? 1025 : columns === 3 ? 640 : 0),
    [columns],
  );

  // Items or column count changed → place (append-stable), before paint.
  // A persisted assignment (back navigation) is kept until all its items are
  // back (the listing restores loaded pages right after the first render).
  useLayoutEffect(() => {
    if (persistKey && hydrated && storedRef.current === undefined) {
      storedRef.current = readPersistedLayout(persistKey, config.columns);
    }
    const stored = storedRef.current && storedRef.current.columns === config.columns ? storedRef.current : null;
    if (stored) {
      const keys = new Set(inputs.map((input) => input.key));
      if ([...stored.assignment.keys()].every((key) => keys.has(key))) storedRef.current = null;
    }
    setLayout((current) => {
      const sameColumns = current.columns === config.columns;
      const unchanged =
        !stored &&
        sameColumns &&
        inputs.length === current.assignment.size &&
        inputs.every((input) => current.assignment.has(input.key));
      if (unchanged) return current;
      const keys = new Set(inputs.map((input) => input.key));
      const removed = [...current.assignment.keys()].some((key) => !keys.has(key));
      const width = containerRef.current?.getBoundingClientRect().width || SSR_CONTAINER_WIDTH_PX;
      return layoutMasonry(
        inputs.map((input) => ({ ...input, textHeight: textHeightRef.current })),
        { ...config, columnWidth: masonryColumnWidth(width, config) },
        stored ?? (sameColumns && !removed ? current : null),
      );
    });
  }, [config, inputs, hydrated, persistKey]);

  useLayoutEffect(() => {
    if (persistKey && hydrated) writePersistedLayout(persistKey, layout);
  }, [persistKey, hydrated, layout]);

  // Measure the real text block height (card minus media box) for future placements.
  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container || typeof ResizeObserver === "undefined") return;
    const measure = () => {
      const samples: number[] = [];
      container.querySelectorAll<HTMLElement>("[data-masonry-item]").forEach((element) => {
        const media = element.querySelector<HTMLElement>("[data-masonry-media]");
        if (!media) return;
        const text = element.getBoundingClientRect().height - media.getBoundingClientRect().height;
        if (Number.isFinite(text) && text >= 0) samples.push(text);
      });
      if (samples.length === 0) return;
      samples.sort((a, b) => a - b);
      textHeightRef.current = samples[Math.floor(samples.length / 2)]!;
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  const byKey = useMemo(
    () => new Map(items.map((item, index) => [item.key, { item, index }])),
    [items],
  );

  return (
    <div
      ref={containerRef}
      data-masonry-columns={hydrated ? layout.columns : undefined}
      className={cn(
        "flex w-full min-w-0 items-start",
        !hydrated && "gap-3 sm:grid sm:grid-cols-3 sm:gap-4 min-[1025px]:grid-cols-4 min-[1025px]:gap-5",
        className,
      )}
      style={hydrated ? { gap: config.gap } : undefined}
    >
      {layout.columnKeys.map((keys, columnIndex) => (
        <div
          key={`column-${columnIndex}`}
          className={cn("flex min-w-0 flex-1 flex-col", !hydrated && "gap-3 sm:contents")}
          style={hydrated ? { gap: config.gap } : undefined}
        >
          {keys.map((key) => {
            const entry = byKey.get(key);
            if (!entry) return null;
            return (
              <div
                key={key}
                data-masonry-item
                className={cn("min-w-0", itemClassName)}
                style={hydrated ? undefined : { order: entry.index }}
              >
                {entry.item.content}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
