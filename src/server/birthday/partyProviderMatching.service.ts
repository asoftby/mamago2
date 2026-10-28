import "server-only";
import { PartyCategory, Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { findCityBySlug } from "@/server/geo/findCityBySlug";
import { getPublicBirthdayOfferWhere } from "./birthdayOfferVisibility";
import { isWithinSchedule, minskBookingWindow } from "./partyConfirmationAvailability";
import { pickPartyProviders, type ProviderOffer } from "./partyProviderMatching";

type MatchingInput = {
  citySlug: string;
  category: PartyCategory;
  venueMode: "VENUE" | "PACKAGE" | "HOME" | "OUTDOOR";
  date: Date;
  timeFrom: string;
  timeTo: string;
  childAgeYears: number | null;
  childrenCount: number;
  adultsCount: number;
  budgetByn: number | null;
  preferredOfferId?: string | null;
  excludeBusinessIds?: string[];
};

/**
 * Read-only candidate discovery. Dispatch policy is a separate step.
 * Never creates BookingRequests or sends notifications.
 */
export async function discoverPartyProviders(
  input: MatchingInput, tx?: Prisma.TransactionClient,
) {
  const db = tx ?? prisma;
  const city = await findCityBySlug(input.citySlug, { select: { id: true }, isActive: true });
  if (!city) return [];
  const guestCount = input.childrenCount + input.adultsCount;
  if (input.childrenCount < 1 || input.adultsCount < 0 || guestCount > 1000) return [];
  const window = minskBookingWindow(input.date, input.timeFrom, input.timeTo, 0, 0);
  const now = new Date();
  if (window.serviceStart <= now) return [];

  const candidates: ProviderOffer[] = [];
  let cursor: string | undefined;
  const dateKey = input.date.toISOString().slice(0, 10);
  const localDay = new Date(dateKey + "T00:00:00+03:00");
  const rangeStart = new Date(localDay.getTime() - 240 * 60_000);
  const rangeEnd = new Date(localDay.getTime() + (24 * 60 + 240) * 60_000);
  while (true) {
  const offers = await db.offer.findMany({
    where: {
      AND: [
        getPublicBirthdayOfferWhere(city.id),
        { productType: "PARTY_SERVICE", category: input.category },
        { place: { ownerBusiness: {
          operationalStatus: "ACTIVE", verificationStatus: "APPROVED",
        } } },
      ],
    },
    select: {
      id: true, category: true, partyLocationType: true, ageMinMonths: true,
      ageMaxMonths: true, minChildren: true, maxChildren: true,
      priceFrom: true, priceMode: true,
      place: { select: { ownerBusinessId: true } },
    },
    orderBy: [{ publishedAt: "desc" }, { id: "asc" }],
    take: 200,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });

    if (!offers.length) break;
    const offerIds = offers.map(offer => offer.id);
    const businessIds = Array.from(new Set(offers.map(o => o.place?.ownerBusinessId).filter(
      (id): id is string => id !== null && id !== undefined)));
  const units = await db.bookingUnit.findMany({
    where: {
      businessId: { in: businessIds },
      offers: { some: { offerId: { in: offerIds } } },
    },
    select: {
      businessId: true, status: true, timezone: true, capacity: true,
      prepMinutes: true, cleanupMinutes: true, minDurationMinutes: true,
      offers: { where: { offerId: { in: offerIds } }, select: { offerId: true } },
      rules: { select: { weekday: true, startMinutes: true, endMinutes: true } },
      exceptions: { where: { date: input.date },
        select: { kind: true, startMinutes: true, endMinutes: true } },
      blocks: { where: { blockStart: { lt: rangeEnd }, blockEnd: { gt: rangeStart } },
        select: { blockStart: true, blockEnd: true } },
      allocations: {
        where: {
          blockStart: { lt: rangeEnd }, blockEnd: { gt: rangeStart },
          OR: [{ status: "CONFIRMED" }, { status: "HELD", expiresAt: { gt: now } }],
        },
        select: { blockStart: true, blockEnd: true },
      },
    },
  });

  const byOffer = new Map<string, typeof units>();
  for (const unit of units) for (const link of unit.offers) {
    const bucket = byOffer.get(link.offerId) ?? [];
    bucket.push(unit);
    byOffer.set(link.offerId, bucket);
  }
  candidates.push(...offers.flatMap(offer => {
    const businessId = offer.place?.ownerBusinessId;
    if (!businessId || !offer.category) return [];
    const mapped = (byOffer.get(offer.id) ?? []).filter(u => u.businessId === businessId);
    let availability: ProviderOffer["availability"] = "UNKNOWN";
    if (mapped.length > 0) {
      const free = mapped.some(unit => {
        if (unit.status !== "ACTIVE" || unit.timezone !== "Europe/Minsk" ||
            unit.capacity !== null && guestCount > unit.capacity) return false;
        const booking = minskBookingWindow(input.date, input.timeFrom, input.timeTo,
          unit.prepMinutes, unit.cleanupMinutes);
        if (unit.minDurationMinutes !== null &&
            booking.serviceEnd.getTime() - booking.serviceStart.getTime() <
              unit.minDurationMinutes * 60_000) return false;
        const overlap = (item: { blockStart: Date; blockEnd: Date }) =>
          item.blockStart < booking.blockEnd && item.blockEnd > booking.blockStart;
        return isWithinSchedule(booking, unit.rules, unit.exceptions) &&
          !unit.blocks.some(overlap) && !unit.allocations.some(overlap);
      });
      availability = free ? "AVAILABLE" : "UNAVAILABLE";
    }
    const priceByn = offer.priceMode === "FREE" ? 0 :
      offer.priceMode === "ON_REQUEST" || offer.priceMode === "UNKNOWN" ||
      offer.priceMode === "NONE" ? null : offer.priceFrom;
    return [{
      id: offer.id, businessId, category: offer.category,
      locationType: offer.partyLocationType,
      ageMinMonths: offer.ageMinMonths, ageMaxMonths: offer.ageMaxMonths,
      minChildren: offer.minChildren, maxChildren: offer.maxChildren,
      priceByn, availability,
    }];
  }));

    const lastId = offers[offers.length - 1].id;
    if (lastId === cursor) throw new Error("Provider matching cursor did not advance");
    cursor = lastId;
    if (offers.length < 200) break;
  }
  return pickPartyProviders({
    offers: candidates, category: input.category, venueMode: input.venueMode,
    childAgeYears: input.childAgeYears, childrenCount: input.childrenCount,
    budgetByn: input.budgetByn, preferredOfferId: input.preferredOfferId,
    excludeBusinessIds: input.excludeBusinessIds,
  });
}
