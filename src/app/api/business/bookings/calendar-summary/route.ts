import { NextRequest, NextResponse } from "next/server";
import { BookingKind, BookingStatus, PublicationType } from "@prisma/client";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/server";
import { getMyBusiness } from "@/server/business/getMyBusiness";
import { buildEventCalendarSummary } from "@/lib/business/eventCalendarSummary";
import { localWallClockToUtc } from "@/lib/date/localDateKey";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function parseDate(value: string | null): Date | null {
  if (!value || !DATE_RE.test(value)) return null;
  const date = new Date(value + "T00:00:00.000Z");
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value ? date : null;
}

/** Aggregate-only read. Never returns customer name, phone, children names or comments. */
export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const business = await getMyBusiness(user.id);
  if (!business) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const url = new URL(request.url);
  const from = parseDate(url.searchParams.get("from"));
  const to = parseDate(url.searchParams.get("to"));
  if (!from || !to || to.getTime() <= from.getTime() || to.getTime() - from.getTime() > 45 * 86_400_000) {
    return NextResponse.json({ error: "Ожидаются from/to и период до 45 дней" }, { status: 400 });
  }
  try {
    // Booking-request calendar snapshots are UTC midnight, but ActivitySession
    // timestamps are instants in Minsk time. Use explicit local bounds.
    const sessionFrom = localWallClockToUtc(from.toISOString().slice(0, 10), "00:00");
    const sessionTo = localWallClockToUtc(to.toISOString().slice(0, 10), "00:00");
    // One grouped DB query, not the truncated general inbox list.
    const groups = await prisma.bookingRequest.groupBy({
      by: ["activityId", "selectedSessionId", "requestedDate", "requestedTime", "status"],
      where: {
        businessId: business.id, kind: BookingKind.STANDARD,
        publicationType: PublicationType.EVENT, activityId: { not: null },
        status: { in: [BookingStatus.NEW, BookingStatus.CONFIRMED] },
        OR: [
          { session: { startsAt: { gte: sessionFrom, lt: sessionTo } } },
          { requestedDate: { gte: from, lt: to } },
        ],
      },
      _count: { _all: true },
      _sum: { adultsCount: true, childrenCount: true },
    });
    const ids = [...new Set(groups.flatMap((g) => g.activityId ? [g.activityId] : []))];
    const sessionIds = [...new Set(groups.flatMap((g) => g.selectedSessionId ? [g.selectedSessionId] : []))];
    const [activities, sessions] = await Promise.all([
      prisma.activity.findMany({ where: { id: { in: ids }, businessId: business.id }, select: { id: true, title: true } }),
      prisma.activitySession.findMany({ where: { id: { in: sessionIds }, activityId: { in: ids } }, select: { id: true, startsAt: true } }),
    ]);
    const summaries = buildEventCalendarSummary(
      groups,
      new Map(sessions.map((s) => [s.id, { startsAt: s.startsAt }])),
      new Map(activities.map((a) => [a.id, a.title])),
    ).filter((item) => item.date >= from.toISOString().slice(0, 10) && item.date < to.toISOString().slice(0, 10));
    return NextResponse.json({ slots: summaries }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("[business bookings calendar-summary]", error);
    return NextResponse.json({ error: "Не удалось получить загрузку календаря" }, { status: 500 });
  }
}
