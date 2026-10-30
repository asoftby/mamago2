import "server-only";
import prisma from "@/lib/prisma";
import { findCityBySlug } from "@/server/geo/findCityBySlug";
import { getPublicBirthdayOfferWhere } from "./birthdayOfferVisibility";
import { previewPartySlots } from "./partyPublicSlots";

/** One-date, one-offer preview; no resource/booking/other-business data is returned. */
export async function getPublicPartySlotPreview(params: {
  citySlug: string;
  offerId: string;
  day: string;
  durationMinutes: number;
  guestCount: number;
}) {
  const city = await findCityBySlug(params.citySlug, { select: { id: true }, isActive: true });
  if (!city) return null;
  const offer = await prisma.offer.findFirst({
    where: { AND: [getPublicBirthdayOfferWhere(city.id), { id: params.offerId }] },
    select: { id: true, place: { select: { ownerBusinessId: true } } },
  });
  const businessId = offer?.place?.ownerBusinessId;
  if (!businessId) return null;

  const now = new Date();
  const date = new Date(params.day + "T00:00:00.000Z");
  const localStart = new Date(params.day + "T00:00:00+03:00");
  // A window may overlap midnight through prep/cleanup buffers (maximum 4 hours).
  const rangeStart = new Date(localStart.getTime() - 240 * 60_000);
  const rangeEnd = new Date(localStart.getTime() + (24 * 60 + 240) * 60_000);
  const units = await prisma.bookingUnit.findMany({
    where: { businessId, offers: { some: { offerId: params.offerId } } },
    select: {
      status: true, timezone: true, capacity: true,
      prepMinutes: true, cleanupMinutes: true,
      minDurationMinutes: true, stepMinutes: true,
      rules: { select: { weekday: true, startMinutes: true, endMinutes: true } },
      exceptions: {
        where: { date },
        select: { kind: true, startMinutes: true, endMinutes: true },
      },
      blocks: {
        where: { blockStart: { lt: rangeEnd }, blockEnd: { gt: rangeStart } },
        select: { blockStart: true, blockEnd: true },
      },
      allocations: {
        where: {
          blockStart: { lt: rangeEnd }, blockEnd: { gt: rangeStart },
          OR: [{ status: "CONFIRMED" }, { status: "HELD", expiresAt: { gt: now } }],
        },
        select: { blockStart: true, blockEnd: true },
      },
    },
  });
  if (units.length === 0) {
    // No configured BookingUnit does not mean the business is free or busy.
    return { mode: "REQUEST_ONLY" as const, slots: [] };
  }
  return {
    mode: "SCHEDULED" as const,
    slots: previewPartySlots({
      day: params.day, durationMinutes: params.durationMinutes,
      guestCount: params.guestCount, now, units,
    }),
  };
}
