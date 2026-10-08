import prisma from "@/lib/prisma";
import { planScopeFor, activePlanScopeFor } from "./familyAccess";
import { familyReadsEnabled } from "./familyScope";
import {
  bookingStatusLabel,
  pickAutoLinkCandidate,
  pickBookingToShow,
  toDateOnly,
  type PlanBookingState,
  type PlanBookingStatus,
} from "./planBookingPure";

export type ResolvePlanLinkInput = {
  userId: string | null | undefined;
  planItemId?: string | null;
  publicationType: "EVENT" | "OFFER" | "PLACE" | string;
  publicationId: string;
  requestedDate: Date | null;
};

/**
 * Plan item a new booking belongs to. An explicit id must be visible to the user
 * (own or shared family item) — otherwise `{ invalid: true }`. Without an id the
 * booking is auto-linked only when exactly one not-yet-booked item matches.
 */
export async function resolveBookingPlanItem(
  input: ResolvePlanLinkInput,
): Promise<{ planItemId: string | null; invalid: boolean }> {
  if (!input.userId) return { planItemId: null, invalid: !!input.planItemId };

  if (input.planItemId) {
    const item = await prisma.planItem.findFirst({
      where: { id: input.planItemId, ...(await activePlanScopeFor(input.userId)) },
      select: { id: true },
    });
    return item ? { planItemId: item.id, invalid: false } : { planItemId: null, invalid: true };
  }

  if (!familyReadsEnabled()) return { planItemId: null, invalid: false };
  const target =
    input.publicationType === "EVENT"
      ? { activityId: input.publicationId }
      : input.publicationType === "PLACE"
        ? { placeId: input.publicationId }
        : null;
  if (!target) return { planItemId: null, invalid: false };

  const rows = await prisma.planItem.findMany({
    where: { ...(await activePlanScopeFor(input.userId)), ...target },
    select: {
      id: true,
      date: true,
      bookingRequests: { where: { status: { in: ["NEW", "CONFIRMED", "COMPLETED"] } }, select: { id: true }, take: 1 },
    },
    take: 20,
  });
  const id = pickAutoLinkCandidate(
    rows.map((r) => ({ id: r.id, date: r.date, hasActiveBooking: r.bookingRequests.length > 0 })),
    toDateOnly(input.requestedDate),
  );
  return { planItemId: id, invalid: false };
}

/**
 * Safe booking state per plan item for the viewer. Returns ONLY status, requested
 * date/time and who booked: never customer name/phone/email, comment, child data
 * or business contacts. Items outside the viewer's plan scope yield nothing.
 */
export async function getPlanBookingStates(
  viewerId: string,
  planItemIds: string[],
): Promise<Map<string, PlanBookingState>> {
  const out = new Map<string, PlanBookingState>();
  if (planItemIds.length === 0) return out;
  const rows = await prisma.bookingRequest.findMany({
    where: {
      planItemId: { in: planItemIds },
      planItem: { is: await planScopeFor(viewerId) },
    },
    select: {
      planItemId: true,
      status: true,
      createdAt: true,
      requestedDate: true,
      requestedTime: true,
      userId: true,
      user: { select: { displayName: true } },
    },
  });
  const byItem = new Map<string, typeof rows>();
  for (const r of rows) {
    if (!r.planItemId) continue;
    const list = byItem.get(r.planItemId) ?? [];
    list.push(r);
    byItem.set(r.planItemId, list);
  }
  for (const [planItemId, list] of byItem) {
    const row = pickBookingToShow(list.map((r) => ({ ...r, status: r.status as PlanBookingStatus })));
    if (!row) continue;
    const isMine = row.userId === viewerId;
    out.set(planItemId, {
      status: row.status,
      label: bookingStatusLabel(row.status),
      requestedDate: toDateOnly(row.requestedDate),
      requestedTime: row.requestedTime,
      isMine,
      bookedByName: isMine ? null : (row.user?.displayName?.trim() || null),
    });
  }
  return out;
}
