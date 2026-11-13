/**
 * Ordered masonry distribution (client-safe, pure).
 *
 * Cards are taken strictly in feed order and each one goes to the currently
 * shortest column (leftmost on ties). Placement of card `i` depends only on
 * cards `0..i-1`, so appending cards never moves already placed ones
 * (infinite scroll safe). Heights are estimates (see `estimateCardHeight`),
 * which keeps the layout computable without measuring the DOM.
 */

export type MasonryColumns = number[][];

/** Returns, per column, the indices of `heights` in feed order. */
export function distributeIntoColumns(heights: readonly number[], columnCount: number): MasonryColumns {
  const count = Math.max(1, Math.floor(columnCount) || 1);
  const columns: MasonryColumns = Array.from({ length: count }, () => []);
  const totals = new Array<number>(count).fill(0);
  heights.forEach((height, index) => {
    let target = 0;
    for (let column = 1; column < count; column += 1) {
      if (totals[column] < totals[target]) target = column;
    }
    columns[target].push(index);
    totals[target] += Number.isFinite(height) && height > 0 ? height : 1;
  });
  return columns;
}

/** Text block under the cover, in units of column width, per column count. */
const DETAILS_RATIO: Record<number, number> = { 2: 0.62, 3: 0.46, 4: 0.36 };

/**
 * Estimated card height in column widths: cover frame ratio (height / width,
 * from `resolvePosterFrame`) plus the details block under it.
 */
export function estimateCardHeight(coverRatio: number, columnCount: number): number {
  const details = DETAILS_RATIO[columnCount] ?? DETAILS_RATIO[4];
  return coverRatio + details;
}

/** Tailwind `sm` (640px) → 3 columns, `md` (768px) → 4 columns, else 2. */
export function columnCountForWidth(viewportWidth: number): number {
  if (viewportWidth >= 768) return 4;
  if (viewportWidth >= 640) return 3;
  return 2;
}

export type StackedColumns = {
  /** Top offset of every card (indexed like the input heights). */
  tops: number[];
  /** Column index of every card. */
  columnOf: number[];
  /** Total height of the tallest column. */
  height: number;
};

/** Stacks cards of each column top to bottom using their measured heights. */
export function stackColumns(columns: MasonryColumns, heights: readonly number[], rowGap: number): StackedColumns {
  const tops = new Array<number>(heights.length).fill(0);
  const columnOf = new Array<number>(heights.length).fill(0);
  let height = 0;
  columns.forEach((indices, column) => {
    let y = 0;
    for (const index of indices) {
      tops[index] = y;
      columnOf[index] = column;
      y += heights[index] + rowGap;
    }
    height = Math.max(height, y - rowGap);
  });
  return { tops, columnOf, height: Math.max(height, 0) };
}
