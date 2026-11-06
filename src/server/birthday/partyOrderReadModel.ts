type Amount = { toFixed(places: number): string };
type Quote = { status: string; priceByn: Amount | null; validUntil: Date | null };
type Request = { id: string; partyStage: string | null; partyQuotes: readonly Quote[] };
type Item = {
  role: string; status: string; offerPriceSnapshot: Amount | null;
  offer?: { priceMode: string; priceFrom: number | null; currency: string } | null;
  confirmedBookingRequestId: string | null; requests: readonly Request[];
};

const money = (values: readonly Amount[]) => {
  if (!values.length) return null;
  const cents = values.reduce((sum, value) => sum + BigInt(value.toFixed(2).replace(".", "")), BigInt(0));
  return String(cents / BigInt(100)) + "." + String(cents % BigInt(100)).padStart(2, "0");
};

/** Read-only projection. Only the accepted quote on the winning request is final. */
export function partyOrderReadModel(order: { status: string; items: readonly Item[] }, now = new Date()) {
  const required = order.items.filter(item => item.role !== "INCLUDED");
  const confirmed = required.filter(item => item.status === "CONFIRMED");
  const remaining = required.filter(item => item.status !== "CONFIRMED");
  const activeQuote = (request: Request) => request.partyQuotes.find(quote =>
    quote.status === "ACTIVE" && quote.validUntil !== null && quote.validUntil > now);
  const final = confirmed.flatMap(item => {
    const winner = item.requests.find(request => request.id === item.confirmedBookingRequestId && request.partyStage === "CONFIRMED");
    const price = winner?.partyQuotes.find(quote => quote.status === "ACCEPTED")?.priceByn;
    return price ? [price] : [];
  });
  const anchor = required.find(item => item.role === "ANCHOR");
  const requests = anchor?.requests ?? [];
  const stage = order.status === "CANCELLED" ? "CANCELLED"
    : order.status === "DRAFT" ? "DRAFT"
    : order.status === "NEEDS_ALTERNATIVE" ? "UNAVAILABLE"
    : confirmed.length && !remaining.length ? "READY"
    : anchor?.status === "CONFIRMED" || order.status === "ANCHOR_CONFIRMED"
      ? confirmed.length > 1 ? "PARTIAL" : "ANCHOR_CONFIRMED"
    : requests.some(request => request.partyStage === "AWAITING_RECONFIRM") ? "AWAITING_CONFIRMATION"
    : requests.some(request => request.partyStage === "QUOTED" && activeQuote(request)) ? "QUOTE_RECEIVED"
    : requests.some(request => request.partyStage === "SENT") ? "WAITING_BUSINESS"
    : requests.length ? "UNAVAILABLE" : "SUBMITTED";
  const estimates = required.flatMap(item => {
    if (item.offerPriceSnapshot !== null) return [item.offerPriceSnapshot];
    const offer = item.offer;
    return order.status === "DRAFT" && offer?.currency === "BYN" && offer.priceMode === "FROM" &&
      offer.priceFrom !== null && Number.isFinite(offer.priceFrom) && offer.priceFrom >= 0 ? [offer.priceFrom] : [];
  });
  const proposed = remaining.flatMap(item => {
    const request = item.requests.find(request => request.partyStage === "AWAITING_RECONFIRM" ||
      (request.partyStage === "QUOTED" && activeQuote(request)));
    const quote = request?.partyStage === "AWAITING_RECONFIRM"
      ? request.partyQuotes.find(quote => quote.status === "ACCEPTED") : request && activeQuote(request);
    return quote?.priceByn ? [quote.priceByn] : [];
  });
  return {
    stage,
    estimate: { knownMinimumByn: order.status === "DRAFT" ? money(estimates) : null, unknownCount: required.length - estimates.length },
    proposed: { knownAmountByn: money(proposed), withoutPriceCount: remaining.length - proposed.length },
    confirmedAmountByn: money(final),
    confirmedPriceUnknownCount: confirmed.length - final.length,
    awaitingCount: remaining.length,
    totalRequired: required.length,
  };
}
