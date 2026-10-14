import type { PrismaClient } from "@prisma/client";

/** Periodic state cleanup; correctness still uses holdUntil and transactional release. */
export async function expireOfferHolds(db: PrismaClient, now = new Date()) {
  const [requests, allocations] = await db.$transaction([
    db.bookingRequest.updateMany({
      where: {
        publicationType: "OFFER",
        status: "NEW",
        holdUntil: { lte: now },
        OR: [{ offerSessionId: { not: null } }, { startsAt: { not: null } }],
      },
      data: { status: "EXPIRED", lastActivityAt: now },
    }),
    db.bookingAllocation.updateMany({
      where: { status: "HELD", expiresAt: { lte: now } },
      data: { status: "EXPIRED" },
    }),
  ]);
  return { requests: requests.count, allocations: allocations.count };
}
