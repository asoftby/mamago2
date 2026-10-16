import type { Prisma } from "@prisma/client";

/** Retain cancelled rows for booking history, never for public discovery.
 * Recurring classes use rules; historical dated rows must stay hidden even
 * between a type-only moderation approval and configuring the new schedule.
 */
export const publicOfferSessionWhere = {
  AND: [
    { isCancelled: false },
    { offer: { OR: [{ productType: null }, { productType: { not: "REGULAR_ACTIVITY" } }] } },
  ],
} satisfies Prisma.OfferSessionWhereInput;
