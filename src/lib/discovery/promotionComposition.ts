/**
 * At most one Boost (paid or free) per four cards within a relevance band,
 * while organic inventory remains. PAID consumes available Boost slots before
 * FREE. Never remove/duplicate candidates, borrow from a worse relevance band,
 * or modify page size/count/cursors. If only boosted inventory remains, retain
 * it instead of inventing organic cards.
 *
 * isFreeBoosted is an internal ranking signal, never an advertising label.
 * Omitting it preserves the historical paid-only composition behavior.
 */
export function composePromotedCards<T extends { isPromoted?: boolean }>(
  cards: T[],
  relevance: (card: T) => string = () => "all",
  isFreeBoosted: (card: T) => boolean = () => false,
): T[] {
  const bands: T[][] = [];
  let previousKey: string | undefined;
  for (const card of cards) {
    const key = relevance(card);
    if (key !== previousKey || bands.length === 0) bands.push([]);
    bands[bands.length - 1].push(card);
    previousKey = key;
  }

  return bands.flatMap(band => {
    const organic = band.filter(card => !card.isPromoted && !isFreeBoosted(card));
    const free = band.filter(card => !card.isPromoted && isFreeBoosted(card));
    const paid = band.filter(card => card.isPromoted);
    const result: T[] = [];
    let o = 0;
    let f = 0;
    let p = 0;

    while (o < organic.length || f < free.length || p < paid.length) {
      const boostedSlot = o >= organic.length || result.length % 4 === 3;
      if (p < paid.length && boostedSlot) result.push(paid[p++]);
      else if (f < free.length && boostedSlot) result.push(free[f++]);
      else result.push(organic[o++]);
    }

    return result;
  });
}
