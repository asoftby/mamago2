import { hasPartyTariffConditions } from "@/lib/offers/partyTariff";
import { selectPartyTariff } from "./partyTariffSelection";
import { parsePriceData } from "@/lib/priceItems";
import type { AvailabilityEvidence, OfferForConstructor, ServiceInterval } from "@/lib/birthday/constructorContract";
import { assertBookingDuration, durationChoices } from "@/server/offers/bookingDuration";
import { BookingPriceError, calculateBookingPrice } from "@/server/offers/bookingPrice";
import { constructorPrice, type ConstructorOfferRow } from "./constructorOffer";

type Price = OfferForConstructor["price"];

/** Called after offer compatibility and availability have been evaluated. */
export function constructorIntervalPrice(
  row: ConstructorOfferRow,
  requested: ServiceInterval | null,
  availability: AvailabilityEvidence,
  guests: number,
  age?: { min: number; max: number },
): Price {
  const fallback = constructorPrice(row);
  const booking = row.offerBooking;
  if (!requested || row.currency !== "BYN") return fallback;

  const duration = (Date.parse(requested.endAt) - Date.parse(requested.startAt)) / 60_000;
  const durationSettings = booking ? {
    scheduleKind: booking.scheduleKind,
    durationMin: booking.durationMin,
    maxExtensionHours: booking.maxExtensionHours,
    extensionHourPriceByn: booking.extensionHourPriceByn?.toFixed(2) ?? null,
    extensionDiscountPercent: booking.extensionDiscountPercent,
    hasClassGroups: row.classGroups.length > 0,
  } : null;
  const offerSource = { entity: "Offer" as const, id: row.id, revision: row.updatedAt.toISOString() };
  if (hasPartyTariffConditions(row.priceItems) && row.priceMode !== "FROM" && row.priceMode !== "ON_REQUEST" && !row.classGroups.length && availability.state === "AVAILABLE" &&
      (!durationSettings?.durationMin || durationChoices(durationSettings).includes(duration)) &&
      !booking?.options.some(option => option.mode === "INCLUDED")) {
    const total = selectPartyTariff({
      items: row.priceItems, interval: requested, guests, age,
      componentIds: row.productType === "PARTY_PACKAGE" ? row.components.filter(component => !component.isOptional).map(component => component.id) : undefined,
    });
    if (total !== null) return { state: "RESOLVED", source: offerSource, price: { kind: "EXACT", amountByn: total } };
  }
  if (hasPartyTariffConditions(row.priceItems) || !booking || row.priceMode !== "EXACT") return fallback;
  const bookingSource = { entity: "OfferBooking" as const, id: booking.id, revision: String(booking.pricingRevision) };
  const unknown = { state: "UNRESOLVED" as const, reason: "POLICY_PENDING" as const, sources: [offerSource, bookingSource] };
  if (row.classGroups.length || (Array.isArray(row.priceItems) && row.priceItems.length > 0) || parsePriceData(row.priceItems).items.length) return unknown;
  if (!booking.durationMin || !durationSettings) return fallback;

  // Options that reserve another unit need a coordinated availability check.
  if (booking.options.some(option => option.mode === "INCLUDED" && option.bookingUnitId)) return unknown;
  const rate = booking.extensionHourPriceByn?.toFixed(2) ?? null;
  const extended = duration > booking.durationMin;
  if (extended && availability.state !== "AVAILABLE") return unknown;
  try {
    assertBookingDuration(durationSettings, duration);
    const choices: { total: string; source: typeof offerSource | typeof bookingSource }[] = [];
    if (booking.basePriceByn !== null) {
      const { snapshot } = calculateBookingPrice({
        currency: row.currency,
        seats: Math.max(1, guests),
        durationMinutes: duration,
        baseDurationMinutes: booking.durationMin,
        extensionHourPriceByn: rate,
        extensionDiscountPercent: booking.extensionDiscountPercent,
        basePriceByn: booking.basePriceByn.toFixed(2),
        tariff: null,
        options: booking.options.map(option => ({ ...option, priceByn: option.priceByn.toFixed(2) })),
      });
      if (snapshot.status === "FIXED" && snapshot.totalByn !== null) choices.push({ total: snapshot.totalByn, source: bookingSource });
    }
    // The public fixed price covers the offer's stated duration only.
    const details = row.details;
    if (!extended && !booking.options.some(option => option.mode === "INCLUDED") && details && typeof details === "object" && !Array.isArray(details) &&
        details.durationMinutes === duration && row.priceFrom !== null &&
        Number.isFinite(row.priceFrom) && row.priceFrom >= 0 && row.priceFrom <= 99999999.99 &&
        Number(row.priceFrom.toFixed(2)) === row.priceFrom) {
      choices.push({ total: row.priceFrom.toFixed(2), source: offerSource });
    }
    choices.sort((a, b) => Number(a.total) - Number(b.total) || a.source.entity.localeCompare(b.source.entity));
    const selected = choices[0];
    return selected ? { state: "RESOLVED", source: selected.source, price: { kind: "EXACT", amountByn: selected.total } } : unknown;
  } catch (error) {
    if (error instanceof RangeError || error instanceof BookingPriceError) return unknown;
    throw error;
  }
}
