/** At most one paid slot per four within each relevance band while organic
 * inventory exists. Stable within each stream; never remove/duplicate cards,
 * borrow from a worse relevance band, or change page size/count/cursors.
 * Paid-only scarcity remains visible rather than fabricating irrelevant fill.
 */
export function composePromotedCards<T extends { isPromoted?: boolean }>(cards: T[], relevance: (card: T) => string = () => "all"): T[] {
  const bands: T[][] = [];
  let previousKey: string | undefined;
  for (const card of cards) {
    const key = relevance(card);
    if (key !== previousKey || bands.length === 0) bands.push([]);
    bands[bands.length - 1].push(card);
    previousKey = key;
  }
  return bands.flatMap(band => {
    const organic = band.filter(card => !card.isPromoted);
    const paid = band.filter(card => card.isPromoted);
    const result: T[] = [];
    let o = 0, p = 0;
    while (o < organic.length || p < paid.length) {
      if (p < paid.length && (o >= organic.length || result.length % 4 === 3)) result.push(paid[p++]);
      else result.push(organic[o++]);
    }
    return result;
  });
}
