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
 * Rebuilds the OfferSession queryable projection from the canonical campSessions JSON.
 * campSessions remains the source of truth (read by booking + 6 other consumers) —
 * this projection is fully derived and safe to delete/recreate on every save.
 * Sessions without both dateFrom/dateTo are skipped (startAt/endAt are NOT NULL).
 */
export async function projectCampSessions(
  db: PrismaLike,
  offerId: string,
  campSessions: unknown,
) {
  await db.offerSession.deleteMany({ where: { offerId } });

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

  if (rows.length > 0) {
    await db.offerSession.createMany({ data: rows });
  }
}
