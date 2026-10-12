import type { Prisma } from "@prisma/client";
import { combineDateTime } from "@/lib/offers/campSessionDates";
import { parseCampSessionPrice } from "@/lib/offers/campPricing";

type PrismaLike = Pick<Prisma.TransactionClient, "offerSession">;

interface NormalizedCampSession {
  dateFrom: string;
  dateTo: string;
  timeFrom: string | null;
  timeTo: string | null;
  capacity: number | null;
  priceOverride: string | null;
}

function normalizeCampSessionForProjection(raw: unknown): NormalizedCampSession | null {
  if (!raw || typeof raw !== "object") return null;
  const s = raw as Record<string, unknown>;
  if (typeof s.dateFrom !== "string" || typeof s.dateTo !== "string") return null;
  return {
    dateFrom: s.dateFrom,
    dateTo: s.dateTo,
    timeFrom: typeof s.timeFrom === "string" ? s.timeFrom : null,
    timeTo: typeof s.timeTo === "string" ? s.timeTo : null,
    capacity: typeof s.capacity === "number" ? s.capacity : null,
    priceOverride: typeof s.priceOverride === "string" ? s.priceOverride : null,
  };
}

/**
 * Reconciles OfferSession from the canonical campSessions JSON.
 * Session IDs must survive edits once BookingRequest.offerSessionId points at them.
 * Sessions without both dateFrom/dateTo are skipped (startAt/endAt are NOT NULL).
 */
export async function projectCampSessions(
  db: PrismaLike,
  offerId: string,
  campSessions: unknown,
) {
  const sessions = Array.isArray(campSessions) ? campSessions : [];
  const rows = sessions
    .map(normalizeCampSessionForProjection)
    .filter((s): s is NormalizedCampSession => s !== null)
    .map((s) => ({
      offerId,
      startAt: combineDateTime(s.dateFrom, s.timeFrom, "00:00"),
      endAt: combineDateTime(s.dateTo, s.timeTo, "23:59"),
      capacity: s.capacity,
      price: parseCampSessionPrice(s.priceOverride) ?? null,
    }));

  const keepStarts = new Set<number>();
  for (const row of rows) {
    const start = row.startAt.getTime();
    if (keepStarts.has(start)) continue;
    keepStarts.add(start);
    await db.offerSession.upsert({
      where: { offerId_startAt: { offerId, startAt: row.startAt } },
      create: row,
      update: { endAt: row.endAt, capacity: row.capacity, price: row.price, isCancelled: false },
    });
  }

  const existing = await db.offerSession.findMany({
    where: { offerId },
    select: { id: true, startAt: true, _count: { select: { bookingRequests: true } } },
  });
  const stale = existing.filter((row) => !keepStarts.has(row.startAt.getTime()));
  const unbookedIds = stale.filter((row) => row._count.bookingRequests === 0).map((row) => row.id);
  const bookedIds = stale.filter((row) => row._count.bookingRequests > 0).map((row) => row.id);
  if (unbookedIds.length > 0) {
    await db.offerSession.deleteMany({ where: { id: { in: unbookedIds } } });
  }
  if (bookedIds.length > 0) {
    await db.offerSession.updateMany({ where: { id: { in: bookedIds } }, data: { isCancelled: true } });
  }
}
