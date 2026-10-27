/** Height of a masonry tile expressed as CSS Grid row tracks (legacy helper, kept for callers). */
export function getOrderedMasonryRowSpan(heightPx: number, rowPx: number, gapPx: number): number {
  if (!Number.isFinite(heightPx) || !Number.isFinite(rowPx) || !Number.isFinite(gapPx) || rowPx <= 0 || gapPx < 0) {
    return 1;
  }
  return Math.max(1, Math.ceil((Math.max(0, heightPx) + gapPx) / (rowPx + gapPx)));
}

// ─── Shortest-column masonry ────────────────────────────────────────────────

export type MasonryColumnsConfig = { columns: number; gap: number };

/** <640px — 2 columns (12px), 640–1024 — 3 (16px), >1024 — 4 (20px). */
export function masonryColumnsForWidth(viewportWidth: number): MasonryColumnsConfig {
  if (viewportWidth > 1024) return { columns: 4, gap: 20 };
  if (viewportWidth >= 640) return { columns: 3, gap: 16 };
  return { columns: 2, gap: 12 };
}

/** SSR has no viewport: the first portion is laid out for the mobile config. */
export const SSR_MASONRY_CONFIG: MasonryColumnsConfig = { columns: 2, gap: 12 };

/** Text block estimate (category + 2-line title + meta) until it is measured. */
export const MASONRY_TEXT_ESTIMATE_PX = 84;
export const MASONRY_DEFAULT_RATIO = 5 / 4;

export type MasonryItemInput = {
  key: string;
  /** height / width of the media box (poster frame). */
  ratio: number;
  /** Measured text block height (full item height minus media box); undefined = not measured yet. */
  textHeight?: number;
};

export type MasonryLayout = {
  columns: number;
  /** item key → column index */
  assignment: Map<string, number>;
  /** keys per column in feed order */
  columnKeys: string[][];
};

function itemHeight(item: MasonryItemInput, columnWidth: number): number {
  const ratio = Number.isFinite(item.ratio) && item.ratio > 0 ? item.ratio : MASONRY_DEFAULT_RATIO;
  const text = item.textHeight != null && Number.isFinite(item.textHeight) && item.textHeight >= 0
    ? item.textHeight
    : MASONRY_TEXT_ESTIMATE_PX;
  return columnWidth * ratio + text;
}

/**
 * Greedy "shortest column" placement in feed order.
 *
 * - Deterministic: same items + widths + measured text heights → same layout.
 * - Stable: when `previous` has the same column count, already placed items
 *   keep their column; only new keys are placed (load-more never moves shown
 *   cards). Items that disappeared are dropped.
 * - Ties go to the leftmost column, so the first row reads in feed order.
 */
export function layoutMasonry(
  items: MasonryItemInput[],
  config: { columns: number; gap: number; columnWidth: number },
  previous?: MasonryLayout | null,
): MasonryLayout {
  const columns = Math.max(1, Math.floor(config.columns));
  const heights = new Array<number>(columns).fill(0);
  const counts = new Array<number>(columns).fill(0);
  const columnKeys: string[][] = Array.from({ length: columns }, () => []);
  const assignment = new Map<string, number>();
  const keep = previous && previous.columns === columns ? previous.assignment : null;

  for (const item of items) {
    let column = keep?.get(item.key);
    if (column === undefined || column >= columns) {
      column = 0;
      for (let c = 1; c < columns; c++) {
        if (heights[c]! < heights[column]! - 0.5) column = c;
      }
    }
    heights[column]! += (counts[column]! > 0 ? config.gap : 0) + itemHeight(item, config.columnWidth);
    counts[column]! += 1;
    columnKeys[column]!.push(item.key);
    assignment.set(item.key, column);
  }

  return { columns, assignment, columnKeys };
}

export function masonryColumnWidth(containerWidth: number, config: MasonryColumnsConfig): number {
  if (!Number.isFinite(containerWidth) || containerWidth <= 0) return 160;
  return Math.max(1, (containerWidth - config.gap * (config.columns - 1)) / config.columns);
}
