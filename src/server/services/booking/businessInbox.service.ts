import "server-only";
import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { scanBusinessInboxPages } from "./businessInboxScan";
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

export async function getBusinessInbox({
  businessId, bucket = "ACTION_REQUIRED", kind = "all", limit = 100, now = new Date(),
}: BusinessInboxOptions) {
  // Scan every booking for exact deadline-dependent counts. Only one page and
  // bounded top-K rows are retained; a LIMIT on the initial query would change
  // bucket membership and badge counts for businesses with long histories.
  const result = await scanBusinessInboxPages({
    fetchPage: (cursor?: string) => prisma.bookingRequest.findMany({
      where: { businessId },
      select: INBOX_SELECT,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 200,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    }),
    classify: (row: InboxRow) => mapDecision(row, now),
    bucket, kind, limit,
  });

  return {
    items: result.items.map(({ row, decision, serviceEndsAt }) => ({
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
    })),
    counts: result.counts,
    totals: result.totals,
    actionGroups: result.actionGroups,
    menuBadge: result.menuBadge,
    housekeepingTotal: result.housekeepingTotal,
    nearestUpcoming: result.nearestUpcoming.map(({ row, serviceEndsAt }) => ({
      id: row.id,
      kind: row.kind,
      title: row.offer?.title ?? row.activity?.title ?? row.place?.title ?? null,
      serviceEndsAt,
    })),
    hasMore: result.hasMore,
  };
}
