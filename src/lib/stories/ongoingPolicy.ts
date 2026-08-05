/**
 * How `window` (Offer.dateFrom–dateTo without sessions) joins temporal slots.
 *
 * (a) always — classic range overlap (default, naive)
 * (b) never — exclude window from temporal slots entirely
 * (c) boundary — include only if the window opens or closes inside the slot
 *
 * DEFAULT `always` is MECHANICAL ONLY — not a product decision.
 * Phase-2 Minsk inventory: published Offers with dateFrom/dateTo = 0.
 * Home cards like «28 июл — 21 авг» are Activity session spans (serial),
 * not Offer windows. Finalize policy after real dated Offers appear.
 */
export type OngoingTemporalPolicy = "always" | "never" | "boundary";

export const DEFAULT_ONGOING_TEMPORAL_POLICY: OngoingTemporalPolicy = "always";

/** Predicate modes for Prisma / in-memory date filters (not inventory classes). */
export type DateRangeMode = "occurrence" | "ongoing";

/**
 * Inventory time class (parent-entity level for Activities).
 * - point  — short session span; belongs to the temporal slot of the session
 * - serial — long multi-session program; temporal slots exclude it → `running`
 * - window — Offer.dateFrom–dateTo without OfferSession
 */
export type TimeClass = "point" | "serial" | "window";
