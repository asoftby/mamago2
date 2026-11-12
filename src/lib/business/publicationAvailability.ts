import type { Role } from "@prisma/client";

/** Temporary rollout gate: enable when the offer wizard, Classes and Parties are ready. */
export const BUSINESS_OFFERS_ENABLED = false;

/** Platform staff can still test and publish offers while partner creation is paused. */
export function canBusinessCreateOffer(role: Role | undefined): boolean {
  return BUSINESS_OFFERS_ENABLED || role === "ADMIN" || role === "MODERATOR";
}
