import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { BookingMode, BookingStatus } from "@prisma/client";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/server";
import { getMyBusiness } from "@/server/business/getMyBusiness";
import { checkRateLimit } from "@/lib/security/rateLimit";
import { logAdminAudit } from "@/server/services/adminAuditLog.service";
import { parseStoredChildren, formatChildLabel } from "@/lib/booking/bookingParticipants";
import { calculateEventSeatAvailability, getEventSeatPolicy } from "@/lib/booking/eventSeatPolicy";
import { eventBookingSlotKey, getEventBookingSchedule } from "@/lib/event/eventBookingSchedule";
import { addDaysLocal, getLocalDateKey, localWallClockToUtc } from "@/lib/date/localDateKey";
import { eventRosterWhere, canShowEventRosterNames } from "@/lib/business/eventRosterScope";
import { formatHHMM } from "@/lib/formatters/date";
import { BusinessSectionHeader } from "@/components/business/sections/BusinessSectionHeader";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 100;
 const dateTime = new Intl.DateTimeFormat("ru-RU", {
  timeZone: "Europe/Minsk", day: "numeric", month: "long",
  year: "numeric", hour: "2-digit", minute: "2-digit",
});

function safePage(raw: string | undefined): number {
  const value = Number(raw);
  return Number.isSafeInteger(value) && value >= 1 && value <= 10000 ? value : 1;
}

function rosterHref(eventId: string, sessionId: string, page = 1): string {
  return "/business/events/" + encodeURIComponent(eventId) +
    "/participants?sessionId=" + encodeURIComponent(sessionId) + "&page=" + page;
}

export default async function EventParticipantsPage({
  params, searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ sessionId?: string; date?: string; page?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const business = await getMyBusiness(user.id);
  if (!business) notFound();
  const { id } = await params;
  const query = await searchParams;

  // Tenant scope is mandatory. Do not load attendees before ownership is checked.
  const activity = await prisma.activity.findFirst({
    where: { id, businessId: business.id, type: "EVENT" },
    select: { id: true, title: true, bookingCapacityPerSlot: true, scheduleJson: true, bookingMode: true },
  });
  if (!activity) notFound();

  const now = new Date();
  // Show upcoming choices first. Explicitly requested past/far-future sessions
  // must remain reachable even when an event has more than 150 occurrences.
  const sessions = await prisma.activitySession.findMany({
    where: { activityId: id, withdrawnAt: null },
    select: { id: true, startsAt: true, title: true },
    orderBy: { startsAt: "asc" },
    take: 150,
  });
  const requestedDate = query.date && /^\d{4}-\d{2}-\d{2}$/.test(query.date) &&
    !Number.isNaN(new Date(query.date).getTime()) &&
    new Date(query.date).toISOString().slice(0, 10) === query.date ? query.date : null;
  if (query.date && !requestedDate) notFound();
  const listedSession = query.sessionId
    ? sessions.find((s) => s.id === query.sessionId)
    : requestedDate
      ? sessions.find((s) => getLocalDateKey(s.startsAt) === requestedDate)
      : undefined;
  // Resolve explicitly requested occurrences outside the first 150 sessions.
  // Never silently show another day if a date/deep link cannot be resolved.
  const requestedSession = !listedSession && query.sessionId
    ? await prisma.activitySession.findFirst({
        where: { id: query.sessionId, activityId: id, withdrawnAt: null },
        select: { id: true, startsAt: true, title: true },
      })
    : !listedSession && requestedDate
      ? await prisma.activitySession.findFirst({
          where: {
            activityId: id, withdrawnAt: null,
            startsAt: {
              gte: localWallClockToUtc(requestedDate, "00:00"),
              lt: localWallClockToUtc(addDaysLocal(requestedDate, 1), "00:00"),
            },
          },
          select: { id: true, startsAt: true, title: true },
          orderBy: { startsAt: "asc" },
        })
      : null;
  if ((query.sessionId || requestedDate) && !listedSession && !requestedSession) notFound();
  if (requestedSession) sessions.push(requestedSession);
  sessions.sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
  const selected = listedSession ?? requestedSession ??
    sessions.find((s) => s.startsAt >= now) ?? sessions[sessions.length - 1];
  const page = safePage(query.page);

  if (!selected) {
    return (
      <div className="space-y-5">
        <BusinessSectionHeader eyebrow="СОБЫТИЯ" title="Участники события" description={activity.title} />
        <p className="rounded-2xl border border-stone-200 bg-white p-5 text-sm text-stone-600">
          Для события ещё нет сеансов. Добавьте расписание, чтобы увидеть список участников.
        </p>
        <Link className="text-sm font-semibold underline" href="/business/events">К списку событий</Link>
      </div>
    );
  }

  const slotDate = getLocalDateKey(selected.startsAt);
  const slotTime = formatHHMM(selected.startsAt);
  const where = eventRosterWhere({
    businessId: business.id,
    activityId: id,
    sessionStartsAt: selected.startsAt,
    bookingMode: activity.bookingMode,
  });
  // Counts use a full aggregate, never the 200-row generic bookings inbox.
  const groups = await prisma.bookingRequest.groupBy({
    by: ["status"], where,
    _count: { _all: true }, _sum: { adultsCount: true, childrenCount: true },
  });
  const bookingCount = groups.reduce((sum, g) => sum + g._count._all, 0);
  const adultsCount = groups.reduce((sum, g) => sum + (g._sum.adultsCount ?? 0), 0);
  const childrenCount = groups.reduce((sum, g) => sum + (g._sum.childrenCount ?? 0), 0);
  const newCount = groups.find((g) => g.status === BookingStatus.NEW)?._count._all ?? 0;
  const confirmedCount = groups.find((g) => g.status === BookingStatus.CONFIRMED)?._count._all ?? 0;

  const policy = getEventSeatPolicy(activity.scheduleJson);
  const slot = getEventBookingSchedule(activity.scheduleJson, activity.bookingMode)
    .get(eventBookingSlotKey(slotDate, activity.bookingMode === BookingMode.USE_PUBLICATION_DATES ? "" : slotTime));
  const availability = calculateEventSeatAvailability({
    policy, capacity: slot?.capacity ?? activity.bookingCapacityPerSlot,
    usedAdults: adultsCount, usedChildren: childrenCount,
  });

  // Bulk names are disclosed only on the Minsk event day, for check-in, and
  // only after the rate limit + durable audit below. Pre-event counts remain.
  const showNames = canShowEventRosterNames({ now, sessionStartsAt: selected.startsAt });
  if (showNames) {
    const rate = await checkRateLimit("business_event_roster:" + business.id + ":" + user.id, 40, 15 * 60 * 1000);
    if (!rate.allowed) {
      return <div role="alert" className="rounded-2xl bg-red-50 p-5 text-sm text-red-800">
        Слишком много запросов списка участников. Повторите позднее.
      </div>;
    }
    await logAdminAudit({
      actorId: user.id, actorRole: user.role, action: "BUSINESS_EVENT_ATTENDEE_ROSTER_VIEWED",
      entityType: "ACTIVITY_SESSION", entityId: selected.id,
      metadata: { businessId: business.id, activityId: id, page },
    });
  }

  const rows = await prisma.bookingRequest.findMany({
    where,
    select: {
      id: true, customerName: true, status: true, source: true,
      adultsCount: true, childrenCount: true, participantChildren: true,
    },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
  });
  const pages = Math.max(1, Math.ceil(bookingCount / PAGE_SIZE));

  return (
    <div className="space-y-5">
      <BusinessSectionHeader eyebrow="СОБЫТИЯ" title="Участники события" description={activity.title} />
      <div className="flex flex-wrap gap-2">
        <Link href="/business/events" className="rounded-full border border-stone-200 px-4 py-2 text-sm font-medium">Все события</Link>
        <Link href="/business/bookings?view=calendar" className="rounded-full border border-stone-200 px-4 py-2 text-sm font-medium">Календарь записей</Link>
      </div>
      <div className="rounded-2xl border border-stone-200 bg-white p-4">
        <h2 className="mb-3 text-base font-semibold">Сеанс: {dateTime.format(selected.startsAt)}</h2>
        <nav aria-label="Выбор сеанса" className="flex max-w-full gap-2 overflow-x-auto pb-2">
          {sessions.map((s) => (
            <Link key={s.id} href={rosterHref(id, s.id)}
              aria-current={s.id === selected.id ? "page" : undefined}
              className={s.id === selected.id ? "shrink-0 rounded-full bg-stone-900 px-4 py-2 text-xs font-semibold text-white" : "shrink-0 rounded-full border border-stone-200 px-4 py-2 text-xs font-semibold text-stone-600"}>
              {dateTime.format(s.startsAt)}
            </Link>
          ))}
        </nav>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Заявок", value: bookingCount },
          { label: "Взрослых", value: adultsCount },
          { label: "Детей", value: childrenCount },
          { label: "Свободно мест", value: availability?.remaining ?? "Без лимита" },
        ].map((metric) => (
          <div key={metric.label} className="rounded-2xl border border-stone-200 bg-white p-4">
            <div className="text-2xl font-bold tabular-nums">{metric.value}</div>
            <div className="mt-1 text-xs text-stone-600">{metric.label}</div>
          </div>
        ))}
      </div>
      {policy.mode === "SEPARATE" && availability ? (
        <p className="text-sm text-stone-600">Свободно: взрослых мест — {availability.adultsRemaining}, детских — {availability.childrenRemaining}</p>
      ) : null}
      <p className="text-sm text-stone-600">Подтверждены: {confirmedCount} · Ожидают подтверждения: {newCount}. Отменённые заявки не занимают места.</p>

      <section aria-labelledby="roster-title" className="overflow-hidden rounded-2xl border border-stone-200 bg-white">
        <h2 id="roster-title" className="border-b border-stone-100 p-4 text-lg font-semibold">Список записей · {bookingCount}</h2>
        {rows.length ? (
          <div className="divide-y divide-stone-100">
            {rows.map((row, index) => {
              const children = parseStoredChildren(row.participantChildren);
              return (
                <div key={row.id} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="space-y-1">
                    <h3 className="font-semibold text-stone-900">
                      {showNames ? (row.customerName?.trim() || "Контакт не указан") : "Запись " + ((page - 1) * PAGE_SIZE + index + 1)}
                    </h3>
                    <p className="text-sm text-stone-600">{row.adultsCount} взрослых · {row.childrenCount} детей
                      {row.source === "MANUAL" ? " · Добавлено вручную" : ""}
                    </p>
                    {showNames && children.length ? (
                      <p className="text-sm text-stone-500">Дети: {children.map(formatChildLabel).join(", ")}</p>
                    ) : null}
                    <p className="text-xs font-medium text-stone-500">{row.status === BookingStatus.CONFIRMED ? "Подтверждено" : "Ожидает подтверждения"}</p>
                  </div>
                  <Link className="inline-flex min-h-10 items-center justify-center rounded-full border border-stone-200 px-4 py-2 text-sm font-semibold"
                    href={"/business/bookings?id=" + encodeURIComponent(row.id)}>
                    Открыть заявку
                  </Link>
                </div>
              );
            })}
          </div>
        ) : <p className="p-5 text-sm text-stone-500">На этот сеанс пока нет активных записей.</p>}
      </section>
      {pages > 1 ? (
        <nav aria-label="Страницы списка участников" className="flex items-center justify-center gap-3 text-sm">
          {page > 1 ? <Link href={rosterHref(id, selected.id, page - 1)} className="rounded-full border px-4 py-2">Назад</Link> : null}
          <span>Страница {page} из {pages}</span>
          {page < pages ? <Link href={rosterHref(id, selected.id, page + 1)} className="rounded-full border px-4 py-2">Следующая</Link> : null}
        </nav>
      ) : null}
      {!showNames ? <p className="text-xs text-stone-500">Имена участников доступны организатору только в день мероприятия. До этого и после него отображается обезличенный список.</p> : null}
    </div>
  );
}
