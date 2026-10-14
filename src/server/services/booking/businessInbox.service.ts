import "server-only";
import prisma from "@/lib/prisma";
import { BookingKind, Prisma } from "@prisma/client";
import {
  bookingBucket, compareBookingDecisions,
  type BookingBucket,
} from "./bookingBucket";

export type BusinessInboxKind = "all" | "standard" | "party";
export interface BusinessInboxOptions {
  businessId: string;
  bucket?: BookingBucket;
  kind?: BusinessInboxKind;
  limit?: number;
  now?: Date;
}

/** Дата без времени считается до конца дня по Минску (не закрываем посещение утром). */
function minskEndOfDay(date: Date | null): Date | null {
  if (!date) return null;
  return new Date(date.toISOString().slice(0, 10) + "T23:59:59.999+03:00");
}

const INBOX_SELECT = {
  id: true, kind: true, status: true, partyStage: true,
  createdAt: true, firstResponseAt: true, lastActivityAt: true,
  requestedDate: true, requestedTime: true, responseDueAt: true,
  startsAt: true, endsAt: true, campShiftDateTo: true,
  session: { select: { startsAt: true } },
  offerSession: { select: { startAt: true, endAt: true } },
  offer: { select: { id: true, title: true } },
  activity: { select: { id: true, title: true } },
  place: { select: { id: true, title: true } },
  partyOrderItem: { select: {
    id: true, partyOrderId: true,
    partyOrder: { select: { eventDate: true, timeFrom: true, timeTo: true } },
  } },
  partyQuotes: {
    orderBy: { version: "desc" as const },
    take: 1,
    select: { id: true, version: true, status: true, validUntil: true },
  },
} satisfies Prisma.BookingRequestSelect;

type InboxRow = Prisma.BookingRequestGetPayload<{ select: typeof INBOX_SELECT }>;

function serviceEnd(row: InboxRow): Date | null {
  const party = row.partyOrderItem?.partyOrder;
  const partyEnd = party?.eventDate && party.timeTo
    ? new Date(party.eventDate.toISOString().slice(0, 10) + "T" + party.timeTo + ":00+03:00")
    : null;
  return row.endsAt ?? partyEnd ??
    row.offerSession?.endAt ??
    minskEndOfDay(row.campShiftDateTo ?? row.requestedDate ??
      row.partyOrderItem?.partyOrder.eventDate ?? row.session?.startsAt ??
      row.offerSession?.startAt ?? row.startsAt);
}

function mapDecision(row: InboxRow, now: Date) {
  const date = serviceEnd(row);
  const decision = bookingBucket({
    kind: row.kind, status: row.status, partyStage: row.partyStage,
    createdAt: row.createdAt, firstResponseAt: row.firstResponseAt,
    hasServiceDate: Boolean(date), serviceEndsAt: date,
    responseDueAt: row.responseDueAt,
    quoteStatus: row.partyQuotes[0]?.status ?? null,
    quoteValidUntil: row.partyQuotes[0]?.validUntil ?? null,
  }, now);
  return { row, createdAt: row.createdAt, decision, serviceEndsAt: date };
}

function emptyCounts() {
  return { ACTION_REQUIRED: 0, UPCOMING: 0, AWAITING_CUSTOMER: 0, ARCHIVE: 0 };
}

export async function getBusinessInbox({
  businessId, bucket = "ACTION_REQUIRED", kind = "all", limit = 100, now = new Date(),
}: BusinessInboxOptions) {
  // Fetch a narrow, contact-free projection: PARTY parent contacts must not leak
  // to the business before confirmation. Counts are computed from ALL rows (not the
  // first page), so badges and filters always agree with the same classifier.
  const rows = await prisma.bookingRequest.findMany({
    where: { businessId },
    select: INBOX_SELECT,
    orderBy: { createdAt: "desc" },
  });
  const decisions = rows.map((row) => mapDecision(row, now));
  const totals = emptyCounts();
  const typeTotals = emptyCounts();
  let customerWaiting = 0;
  let housekeeping = 0;
  let filteredCustomerWaiting = 0;
  let filteredHousekeeping = 0;

  for (const item of decisions) {
    const { decision } = item;
    totals[decision.bucket]++;
    const matchesKind = kind === "all" ||
      item.row.kind === (kind === "party" ? BookingKind.PARTY : BookingKind.STANDARD);
    if (decision.urgency === "CUSTOMER_WAITING") customerWaiting++;
    if (decision.urgency === "HOUSEKEEPING") housekeeping++;
    if (!matchesKind) continue;
    typeTotals[decision.bucket]++;
    if (decision.urgency === "CUSTOMER_WAITING") filteredCustomerWaiting++;
    if (decision.urgency === "HOUSEKEEPING") filteredHousekeeping++;
  }

  const items = decisions
    .filter(({ row, decision }) =>
      decision.bucket === bucket &&
      (kind === "all" || row.kind === (kind === "party" ? BookingKind.PARTY : BookingKind.STANDARD)))
    .sort(compareBookingDecisions)
    .slice(0, Math.min(100, Math.max(1, limit)))
    .map(({ row, decision, serviceEndsAt }) => ({
      id: row.id,
      kind: row.kind,
      status: row.status,
      partyStage: row.partyStage,
      createdAt: row.createdAt,
      // No parent PII, contact, comments or personal info in this endpoint.
      title: row.offer?.title ?? row.activity?.title ?? row.place?.title ?? null,
      offerId: row.offer?.id ?? null,
      partyOrderId: row.partyOrderItem?.partyOrderId ?? null,
      requestedDate: row.requestedDate ?? row.partyOrderItem?.partyOrder.eventDate ?? null,
      requestedTime: row.requestedTime ?? row.partyOrderItem?.partyOrder.timeFrom ?? null,
      serviceEndsAt,
      responseDueAt: row.responseDueAt,
      quote: row.partyQuotes[0] ?? null,
      bucket: decision.bucket,
      urgency: decision.urgency,
      nextAction: decision.action,
      deadline: decision.deadline,
    }));

  const nearestUpcoming = bucket === "ACTION_REQUIRED"
    ? decisions
        .filter((item) => item.decision.bucket === "UPCOMING")
        .sort(compareBookingDecisions)
        .slice(0, 3)
        .map(({ row, serviceEndsAt }) => ({
          id: row.id, kind: row.kind,
          title: row.offer?.title ?? row.activity?.title ?? row.place?.title ?? null,
          serviceEndsAt,
        }))
    : [];
  return {
    items,
    counts: typeTotals,
    totals,
    actionGroups: { customerWaiting: filteredCustomerWaiting, housekeeping: filteredHousekeeping },
    menuBadge: customerWaiting, // housekeeping is deliberately excluded
    housekeepingTotal: housekeeping,
    nearestUpcoming,
    hasMore: decisions.some(({ row, decision }) =>
      decision.bucket === bucket &&
      (kind === "all" || row.kind === (kind === "party" ? BookingKind.PARTY : BookingKind.STANDARD))) &&
      typeTotals[bucket] > items.length,
  };
}
