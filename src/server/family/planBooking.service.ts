import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { planScopeFor, activePlanScopeFor, familyIdForWrite } from "./familyAccess";
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
 * Resolve the plan occurrence for a booked Event while the caller holds the
 * Activity FOR UPDATE lock and is creating BookingRequest in the same DB
 * transaction. A failed booking cannot leave a phantom PlanItem behind.
 *
 * Prefer an existing occurrence at exactly this time; otherwise reuse an
 * unbooked item already saved for this day. A second independently booked
 * time on the same day gets a separate occurrence rather than moving the
 * first booking in the user's plan.
 */
export async function ensureEventBookingPlanItem(
  tx: Prisma.TransactionClient,
  input: {
    userId: string | null | undefined;
    activityId: string;
    date: Date | null;
    startsAt: Date | null;
    title: string;
    coverImageUrl: string | null;
    linkedPlanItemId: string | null;
  },
): Promise<string | null> {
  if (input.linkedPlanItemId) return input.linkedPlanItemId;
  if (!input.userId || !input.date) return null;

  const date = input.date.toISOString().slice(0, 10);
  const candidates = await tx.planItem.findMany({
    where: {
      ...(await activePlanScopeFor(input.userId)),
      activityId: input.activityId,
      date,
    },
    select: {
      id: true,
      startsAt: true,
      bookingRequests: {
        where: { status: { in: ["NEW", "CONFIRMED", "COMPLETED"] } },
        select: { id: true },
        take: 1,
      },
    },
    orderBy: { createdAt: "desc" },
    take: 25,
  });
  const sameTime = candidates.find((item) =>
    (item.startsAt?.getTime() ?? null) === (input.startsAt?.getTime() ?? null),
  );
  const unbooked = candidates.find((item) => item.bookingRequests.length === 0);
  const existing = sameTime ?? unbooked;
  if (existing) {
    if (existing.bookingRequests.length === 0 && input.startsAt) {
      await tx.planItem.update({
        where: { id: existing.id },
        data: { startsAt: input.startsAt },
      });
    }
    return existing.id;
  }

  const created = await tx.planItem.create({
    data: {
      userId: input.userId,
      familyId: await familyIdForWrite(input.userId),
      activityId: input.activityId,
      date,
      startsAt: input.startsAt,
      title: input.title,
      coverImageUrl: input.coverImageUrl,
    },
    select: { id: true },
  });
  return created.id;
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
