import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";

export type BookingServicesInput = {
  revision: number;
  basePriceByn: string | null;
  options: Array<{
    id?: string;
    title: string;
    mode: "INCLUDED" | "OPTIONAL" | "STANDALONE";
    priceByn: string;
    bookingUnitId: string | null;
    active: boolean;
  }>;
};

export type BookingServicesResult = {
  status: 200 | 404 | 409 | 422;
  revision?: number;
};

/** Single canonical operational write for all editors; no content moderation or existing tariffs rewritten. */
export async function saveBookingServices(input: {
  offerId: string; businessId: string; data: BookingServicesInput;
}): Promise<BookingServicesResult> {
  const { offerId, businessId, data } = input;
  const ids = data.options.flatMap(option => option.id ? [option.id] : []);
  if (new Set(ids).size !== ids.length || data.options.some(option =>
      option.mode === "INCLUDED" && Number(option.priceByn) !== 0 ||
      option.mode === "STANDALONE" && option.bookingUnitId !== null)) {
    return { status: 422 };
  }
  // Disabled extras may retain historical resource links; allow businesses
  // to turn them off even if a room was deactivated or schedule changed.
  // Validate and lock down only resources that can actually be booked.
  const resourceIds = [...new Set(data.options.filter(o => o.active).flatMap(o =>
    o.bookingUnitId ? [o.bookingUnitId] : []))];
  return prisma.$transaction(async (tx): Promise<BookingServicesResult> => {
    // Serializes first-write creation, concurrent edits, and resource validation.
    await tx.$queryRaw`SELECT "id" FROM "Offer" WHERE "id" = ${offerId} FOR UPDATE`;
    const offer = await tx.offer.findUnique({
      where: { id: offerId },
      select: {
        currency: true, place: { select: { ownerBusinessId: true } },
        classGroups: { where: { active: true }, select: { id: true } },
        offerBooking: { select: {
          id: true, pricingRevision: true, scheduleKind: true, options: { select: { id: true } },
        } },
      },
    });
    if (!offer || offer.place?.ownerBusinessId !== businessId) return { status: 404 };
    if (offer.currency !== "BYN") return { status: 422 };
    const previous = offer.offerBooking;
    if ((previous?.pricingRevision ?? 0) !== data.revision) return { status: 409 };

    // Group seats are not BookingUnits; cannot promise resource-linked
    // extras that class reservation cannot hold atomically.
    if (resourceIds.length > 0 && (offer.classGroups.length > 0 ||
        offer.offerBooking?.scheduleKind !== "ON_REQUEST_WINDOWS")) {
      return { status: 422 };
    }
    if (resourceIds.length > 0) {
      const count = await tx.bookingUnitOffer.count({ where: {
        offerId, bookingUnitId: { in: resourceIds },
        bookingUnit: { businessId, type: "EXCLUSIVE", status: "ACTIVE" },
      } });
      if (count !== resourceIds.length) return { status: 422 };
    }
    const existingIds = new Set((previous?.options ?? []).map(o => o.id));
    if (ids.some(id => !existingIds.has(id))) return { status: 422 };

    const booking = previous ?? await tx.offerBooking.create({
      data: { offerId }, select: { id: true, pricingRevision: true },
    });
    const changed = await tx.offerBooking.updateMany({
      where: { id: booking.id, pricingRevision: data.revision },
      data: {
        basePriceByn: data.basePriceByn === null ? null : new Prisma.Decimal(data.basePriceByn),
        pricingRevision: { increment: 1 },
      },
    });
    if (changed.count !== 1) return { status: 409 };
    const retained = new Set(ids);
    await tx.offerBookingOption.deleteMany({
      where: { offerBookingId: booking.id, ...(retained.size ? { id: { notIn: [...retained] } } : {}) },
    });
    for (const [position, option] of data.options.entries()) {
      const payload = {
        title: option.title, mode: option.mode, active: option.active,
        position, priceByn: new Prisma.Decimal(option.priceByn),
        bookingUnitId: option.bookingUnitId,
      };
      if (option.id) {
        await tx.offerBookingOption.update({ where: { id: option.id, offerBookingId: booking.id },
          data: payload });
      } else {
        await tx.offerBookingOption.create({ data: { ...payload, offerBookingId: booking.id } });
      }
    }
    return { status: 200, revision: data.revision + 1 };
  }, { timeout: 20_000 });
}
