import { getPublicBirthdayOfferWhere } from "./birthdayOfferVisibility";
import { constructorBusinessSelect, isEligibleForConstructor } from "./constructorEligibility";
import "server-only";
import type { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import type { AvailabilityEvidence, ServiceInterval } from "@/lib/birthday/constructorContract";
import { assessPartyAvailability, type ConstructorUnit } from "./partyAvailabilityPreview.logic";
import { minskBookingWindow } from "./partyConfirmationAvailability";

/** Batch the relations once per candidate page; no per-offer DB fan-out. */
export async function loadPartyAvailability(db: Prisma.TransactionClient, offers: readonly { id: string; businessId: string }[], requested: ServiceInterval | null, guestCount: number, now: Date) {
  const result = new Map<string, { availability: AvailabilityEvidence; units: ConstructorUnit[] }>();
  if (!requested || !offers.length) {
    for (const offer of offers) result.set(offer.id, { availability: { state: "UNKNOWN", reason: "NO_EXACT_TIME" }, units: [] });
    return result;
  }
  const start = new Date(requested.startAt), end = new Date(requested.endAt);
  const day = new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Minsk", dateStyle: "short" }).format(start);
  const date = new Date(day + "T00:00:00.000Z");
  const localStart = new Date(day + "T00:00:00+03:00");
  const rangeStart = new Date(Math.min(start.getTime(), localStart.getTime()) - 240 * 60_000);
  const rangeEnd = new Date(Math.max(end.getTime(), localStart.getTime() + 24*60*60_000) + 240 * 60_000);
  const ids = offers.map(o => o.id), businesses = [...new Set(offers.map(o => o.businessId))];
  const rows = await db.bookingUnit.findMany({
    where: { businessId: { in: businesses }, offers: { some: { offerId: { in: ids } } } },
    select: {
      id: true, updatedAt: true, businessId: true, status: true, timezone: true, capacity: true,
      prepMinutes: true, cleanupMinutes: true, minDurationMinutes: true, stepMinutes: true,
      offers: { where: { offerId: { in: ids } }, select: { offerId: true } },
      rules: { select: { weekday: true, startMinutes: true, endMinutes: true } },
      exceptions: { where: { date }, select: { kind: true, startMinutes: true, endMinutes: true } },
      blocks: { where: { blockStart: { lt: rangeEnd }, blockEnd: { gt: rangeStart } }, select: { blockStart: true, blockEnd: true } },
      allocations: { where: { blockStart: { lt: rangeEnd }, blockEnd: { gt: rangeStart }, OR: [
        { status: "CONFIRMED" }, { status: "HELD", expiresAt: { gt: now } },
      ] }, select: { blockStart: true, blockEnd: true } },
    },
  });
  const ownership = new Map(offers.map(o => [o.id, o.businessId]));
  const byOffer = new Map<string, ConstructorUnit[]>();
  for (const row of rows) for (const link of row.offers) {
    if (ownership.get(link.offerId) !== row.businessId) continue;
    const list = byOffer.get(link.offerId) ?? []; list.push(row); byOffer.set(link.offerId,list);
  }
  for (const offer of offers) {
    const units = byOffer.get(offer.id) ?? [];
    result.set(offer.id, { availability: assessPartyAvailability(units, requested, guestCount, now), units });
  }
  return result;
}

/** Backwards-compatible one-offer wrapper; final confirmation still locks/rechecks independently. */
export async function previewPartyOfferAvailability(input: { offerId: string; date: string; timeFrom: string; timeTo: string; childrenCount: number; adultsCount: number }) {
  const offer = await prisma.offer.findFirst({ where: { AND: [getPublicBirthdayOfferWhere(null), { id: input.offerId }] }, select: { id: true, place: { select: { ownerBusinessId: true, ownerBusiness: { select: constructorBusinessSelect } } } } });
  if (!offer?.place?.ownerBusinessId || !isEligibleForConstructor(offer.place.ownerBusiness)) return { availability: "UNKNOWN" as const };
  const w = minskBookingWindow(new Date(input.date + "T00:00:00.000Z"), input.timeFrom, input.timeTo,0,0);
  const evidence = (await loadPartyAvailability(prisma, [{ id: offer.id, businessId: offer.place.ownerBusinessId }],
    { startAt: w.serviceStart.toISOString(), endAt: w.serviceEnd.toISOString() }, input.childrenCount + input.adultsCount, new Date())).get(offer.id)!;
  // No resource IDs/allocations in this legacy/public response.
  return { availability: evidence.availability.state };
}
