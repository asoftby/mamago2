/** Height of a masonry tile expressed as CSS Grid row tracks. */
export function getOrderedMasonryRowSpan(heightPx: number, rowPx: number, gapPx: number): number {
  if (!Number.isFinite(heightPx) || !Number.isFinite(rowPx) || !Number.isFinite(gapPx) || rowPx <= 0 || gapPx < 0) {
    return 1;
  }
  return Math.max(1, Math.ceil((Math.max(0, heightPx) + gapPx) / (rowPx + gapPx)));
}
