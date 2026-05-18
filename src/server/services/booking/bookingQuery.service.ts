/**
 * Booking Query Service
 * Чтение и обновление заявок для бизнес-кабинета.
 */

import prisma from "@/lib/prisma";
import { BookingStatus } from "@prisma/client";
import { buildBookingDisplay } from "./booking.formatters";
import { resolveBookingSourceType } from "./booking.types";
import type { BookingDisplay } from "./booking.types";
import { recordStatusChanged } from "./bookingActivity.service";
import {
  notifyUserBookingConfirmed,
  notifyUserBookingCancelled,
  notifyUserBookingCompleted,
  notifyUserBookingFeedbackRequest,
} from "@/server/services/notification.service";
import {
  trackBookingConfirmed,
  trackBookingCompleted,
  trackBookingCancelled,
} from "@/server/analytics/trackBookingEvent";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface BusinessBookingItem {
  id: string;
  status: BookingStatus;
  publicationType: string;
  createdAt: string;

  // Normalized display (computed, not stored)
  display: BookingDisplay;

  // Publication refs
  offerId: string | null;
  activityId: string | null;
  placeId: string | null;
  offer: { id: string; title: string; slug: string | null } | null;
  activity: { id: string; title: string; slug: string | null } | null;
  place: { id: string; title: string; slug: string | null } | null;

  // Camp shift snapshot
  campShiftId: string | null;
  campShiftTitle: string | null;
  campShiftDateFrom: string | null;
  campShiftDateTo: string | null;

  // Customer
  customerName: string;
  customerPhone: string;
  customerEmail: string | null;
  customerComment: string | null;

  // Child
  childName: string | null;
  childAge: number | null;

  // Counts
  adultsCount: number;
  childrenCount: number;

  // Date/time (for non-camp bookings)
  requestedDate: string | null;
  requestedTime: string | null;
  session: { id: string; startsAt: string } | null;

  // Stale lead signals (computed)
  isStale: boolean;
  staleType: "BOOKING_STALE" | "BOOKING_NEEDS_ATTENTION" | null;
}

export interface GetBusinessBookingsOptions {
  businessId: string;
  status?: BookingStatus;
  date?: Date;
  weekStart?: Date;
}

export interface WeekDayCount {
  date: string;
  total: number;
  newCount: number;
  confirmedCount: number;
}

export interface BookingStatusCounts {
  all: number;
  new: number;
  confirmed: number;
  completed: number;
  rejected: number;
}

export interface GetBusinessBookingsResult {
  items: BusinessBookingItem[];
  counts: BookingStatusCounts;
  weekCounts?: WeekDayCount[];
}

// ─── Prisma select shape ──────────────────────────────────────────────────────

const BOOKING_SELECT = {
  id: true,
  status: true,
  publicationType: true,
  createdAt: true,
  lastActivityAt: true,

  offerId: true,
  activityId: true,
  placeId: true,
  offer: { select: { id: true, title: true, slug: true } },
  activity: { select: { id: true, title: true, slug: true } },
  place: { select: { id: true, title: true, slug: true } },

  campShiftId: true,
  campShiftTitle: true,
  campShiftDateFrom: true,
  campShiftDateTo: true,

  customerName: true,
  customerPhone: true,
  customerEmail: true,
  customerComment: true,

  childName: true,
  childAge: true,

  adultsCount: true,
  childrenCount: true,

  requestedDate: true,
  requestedTime: true,
  session: { select: { id: true, startsAt: true } },
} as const;

// ─── Stale helpers (mirrors bookingStale.service thresholds) ─────────────────

const STALE_NEW_MS       = 24 * 3_600_000;
const STALE_CONFIRMED_MS = 72 * 3_600_000;

function computeStale(
  status: BookingStatus,
  createdAt: Date,
  lastActivityAt: Date,
): { isStale: boolean; staleType: "BOOKING_STALE" | "BOOKING_NEEDS_ATTENTION" | null } {
  const now = Date.now();
  if (status === BookingStatus.NEW && now - createdAt.getTime() > STALE_NEW_MS) {
    return { isStale: true, staleType: "BOOKING_STALE" };
  }
  if (status === BookingStatus.CONFIRMED && now - lastActivityAt.getTime() > STALE_CONFIRMED_MS) {
    return { isStale: true, staleType: "BOOKING_NEEDS_ATTENTION" };
  }
  return { isStale: false, staleType: null };
}

// ─── Mapper ───────────────────────────────────────────────────────────────────

function mapBooking(raw: {
  id: string;
  status: BookingStatus;
  publicationType: string;
  createdAt: Date;
  lastActivityAt: Date;
  offerId: string | null;
  activityId: string | null;
  placeId: string | null;
  offer: { id: string; title: string; slug: string | null } | null;
  activity: { id: string; title: string; slug: string | null } | null;
  place: { id: string; title: string; slug: string | null } | null;
  campShiftId: string | null;
  campShiftTitle: string | null;
  campShiftDateFrom: Date | null;
  campShiftDateTo: Date | null;
  customerName: string;
  customerPhone: string;
  customerEmail: string | null;
  customerComment: string | null;
  childName: string | null;
  childAge: number | null;
  adultsCount: number;
  childrenCount: number;
  requestedDate: Date | null;
  requestedTime: string | null;
  session: { id: string; startsAt: Date } | null;
}): BusinessBookingItem {
  const campShiftDateFrom = raw.campShiftDateFrom?.toISOString() ?? null;
  const campShiftDateTo = raw.campShiftDateTo?.toISOString() ?? null;
  const requestedDate = raw.requestedDate?.toISOString() ?? null;
  const session = raw.session
    ? { id: raw.session.id, startsAt: raw.session.startsAt.toISOString() }
    : null;

  const display = buildBookingDisplay({
    campShiftId: raw.campShiftId,
    campShiftTitle: raw.campShiftTitle,
    campShiftDateFrom,
    campShiftDateTo,
    offerId: raw.offerId,
    activityId: raw.activityId,
    placeId: raw.placeId,
    offer: raw.offer,
    activity: raw.activity,
    place: raw.place,
    childName: raw.childName,
    childAge: raw.childAge,
    customerName: raw.customerName,
    requestedDate,
    requestedTime: raw.requestedTime,
    session,
  });

  const { isStale, staleType } = computeStale(raw.status, raw.createdAt, raw.lastActivityAt);

  return {
    id: raw.id,
    status: raw.status,
    publicationType: raw.publicationType,
    createdAt: raw.createdAt.toISOString(),
    display,

    offerId: raw.offerId,
    activityId: raw.activityId,
    placeId: raw.placeId,
    offer: raw.offer,
    activity: raw.activity,
    place: raw.place,

    campShiftId: raw.campShiftId,
    campShiftTitle: raw.campShiftTitle,
    campShiftDateFrom,
    campShiftDateTo,

    customerName: raw.customerName,
    customerPhone: raw.customerPhone,
    customerEmail: raw.customerEmail,
    customerComment: raw.customerComment,

    childName: raw.childName,
    childAge: raw.childAge,

    adultsCount: raw.adultsCount,
    childrenCount: raw.childrenCount,

    requestedDate,
    requestedTime: raw.requestedTime,
    session,

    isStale,
    staleType,
  };
}

// ─── Query ────────────────────────────────────────────────────────────────────

export async function getBusinessBookings(
  opts: GetBusinessBookingsOptions,
): Promise<GetBusinessBookingsResult> {
  const { businessId, status, date, weekStart } = opts;

  // ── Date filter ──
  let dateFilter: Record<string, unknown> | undefined;
  if (date) {
    const nextDay = new Date(date);
    nextDay.setDate(nextDay.getDate() + 1);
    dateFilter = {
      OR: [
        { requestedDate: { gte: date, lt: nextDay } },
        { campShiftDateFrom: { gte: date, lt: nextDay } },
        { session: { startsAt: { gte: date, lt: nextDay } } },
      ],
    };
  }

  const baseWhere = {
    businessId,
    ...(dateFilter ?? {}),
  };

  // ── Fetch items + counts in parallel ──
  const [rows, countRows] = await Promise.all([
    prisma.bookingRequest.findMany({
      where: { ...baseWhere, ...(status ? { status } : {}) },
      select: BOOKING_SELECT,
      // NEW first, then newest first within each status group
      orderBy: [
        {
          status: "asc", // NEW sorts before CONFIRMED/COMPLETED/REJECTED alphabetically
        },
        { createdAt: "desc" },
      ],
      take: 200,
    }),
    // Count per status (always unfiltered by status for accurate tab counts)
    prisma.bookingRequest.groupBy({
      by: ["status"],
      where: baseWhere,
      _count: { _all: true },
    }),
  ]);

  // Sort: NEW first, then by createdAt desc
  const sorted = [...rows].sort((a, b) => {
    if (a.status === BookingStatus.NEW && b.status !== BookingStatus.NEW) return -1;
    if (a.status !== BookingStatus.NEW && b.status === BookingStatus.NEW) return 1;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  const items = sorted.map(mapBooking);

  // ── Build counts ──
  const countMap = new Map(countRows.map((r) => [r.status, r._count._all]));
  const counts: BookingStatusCounts = {
    all: countRows.reduce((sum, r) => sum + r._count._all, 0),
    new: countMap.get(BookingStatus.NEW) ?? 0,
    confirmed: countMap.get(BookingStatus.CONFIRMED) ?? 0,
    completed: countMap.get(BookingStatus.COMPLETED) ?? 0,
    rejected: countMap.get(BookingStatus.REJECTED) ?? 0,
  };

  // ── Week counts ──
  let weekCounts: WeekDayCount[] | undefined;
  if (weekStart) {
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 7);

    const weekRows = await prisma.bookingRequest.findMany({
      where: {
        businessId,
        createdAt: { gte: weekStart, lt: weekEnd },
      },
      select: { createdAt: true, status: true },
    });

    weekCounts = [];
    for (let i = 0; i < 7; i++) {
      const day = new Date(weekStart);
      day.setDate(day.getDate() + i);
      const dayStr = day.toISOString().split("T")[0]!;
      const nextDay = new Date(day);
      nextDay.setDate(nextDay.getDate() + 1);

      const dayRows = weekRows.filter((r) => {
        const d = r.createdAt;
        return d >= day && d < nextDay;
      });

      weekCounts.push({
        date: dayStr,
        total: dayRows.length,
        newCount: dayRows.filter((r) => r.status === BookingStatus.NEW).length,
        confirmedCount: dayRows.filter((r) => r.status === BookingStatus.CONFIRMED).length,
      });
    }
  }

  return { items, counts, weekCounts };
}

// ─── Status update ────────────────────────────────────────────────────────────

/** Допустимые переходы статусов */
const ALLOWED_TRANSITIONS: Partial<Record<BookingStatus, BookingStatus[]>> = {
  [BookingStatus.NEW]: [BookingStatus.CONFIRMED, BookingStatus.REJECTED],
  [BookingStatus.CONFIRMED]: [BookingStatus.COMPLETED, BookingStatus.REJECTED],
};

export class BookingStatusTransitionError extends Error {
  constructor(from: BookingStatus, to: BookingStatus) {
    super(`Нельзя перевести заявку из статуса ${from} в ${to}`);
    this.name = "BookingStatusTransitionError";
  }
}

export class BookingOwnershipError extends Error {
  constructor() {
    super("Заявка не принадлежит этому бизнесу");
    this.name = "BookingOwnershipError";
  }
}

export async function updateBookingStatus(
  bookingId: string,
  businessId: string,
  newStatus: BookingStatus,
): Promise<BusinessBookingItem> {
  // 1. Загружаем заявку
  const existing = await prisma.bookingRequest.findUnique({
    where: { id: bookingId },
    select: {
      id: true,
      businessId: true,
      status: true,
      createdAt: true,
      firstResponseAt: true,
      userId: true,
      offer: { select: { id: true, title: true } },
      activity: { select: { id: true, title: true } },
      place: { select: { id: true, title: true } },
    },
  });

  if (!existing) {
    throw new Error("Заявка не найдена");
  }

  // 2. Проверяем владельца
  if (existing.businessId !== businessId) {
    throw new BookingOwnershipError();
  }

  // 3. Проверяем допустимость перехода
  const allowed = ALLOWED_TRANSITIONS[existing.status] ?? [];
  if (!allowed.includes(newStatus)) {
    throw new BookingStatusTransitionError(existing.status, newStatus);
  }

  // 4. Вычисляем derived fields для этого перехода
  const now = new Date();
  const derivedData: {
    firstResponseAt?: Date;
    responseTimeMinutes?: number;
    completedAt?: Date;
    rejectedAt?: Date;
  } = {};

  if (newStatus === BookingStatus.CONFIRMED && existing.status === BookingStatus.NEW) {
    // Первый ответ: NEW → CONFIRMED
    if (!existing.firstResponseAt) {
      derivedData.firstResponseAt = now;
      derivedData.responseTimeMinutes = Math.round(
        (now.getTime() - existing.createdAt.getTime()) / 60_000,
      );
    }
  } else if (newStatus === BookingStatus.COMPLETED) {
    // Завершение: CONFIRMED → COMPLETED
    derivedData.completedAt = now;
  } else if (newStatus === BookingStatus.REJECTED) {
    // Отклонение: NEW|CONFIRMED → REJECTED
    derivedData.rejectedAt = now;
  }

  // 5. Обновляем
  const updated = await prisma.bookingRequest.update({
    where: { id: bookingId },
    data: { status: newStatus, ...derivedData },
    select: BOOKING_SELECT,
  });

  // Fire-and-forget: activity event
  recordStatusChanged(bookingId, existing.status, newStatus);

  // Fire-and-forget: analytics tracking
  if (newStatus === BookingStatus.CONFIRMED) {
    void trackBookingConfirmed({
      userId: existing.userId ?? null,
      bookingId,
      entityType: "OFFER",
      entityId: existing.offer?.id ?? "",
      vertical: "CITY",
      metadata: {
        status: newStatus,
        responseTimeMinutes: derivedData.responseTimeMinutes,
        source: "admin",
        surface: "web",
      },
    });
  } else if (newStatus === BookingStatus.COMPLETED) {
    void trackBookingCompleted({
      userId: existing.userId ?? null,
      bookingId,
      entityType: "OFFER",
      entityId: existing.offer?.id ?? "",
      vertical: "CITY",
      metadata: {
        status: newStatus,
        source: "admin",
        surface: "web",
      },
    });
  } else if (newStatus === BookingStatus.REJECTED || newStatus === BookingStatus.CANCELLED) {
    void trackBookingCancelled({
      userId: existing.userId ?? null,
      bookingId,
      entityType: "OFFER",
      entityId: existing.offer?.id ?? "",
      vertical: "CITY",
      metadata: {
        status: newStatus,
        source: "admin",
        surface: "web",
      },
    });
  }

  // Fire-and-forget: user lifecycle notifications (только если заявка от авторизованного пользователя)
  if (existing.userId) {
    const publicationTitle =
      existing.offer?.title ?? existing.activity?.title ?? existing.place?.title ?? null;

    const notifyParams = {
      userId: existing.userId,
      bookingId,
      publicationTitle,
    };

    if (newStatus === BookingStatus.CONFIRMED) {
      notifyUserBookingConfirmed(notifyParams).catch((err) =>
        console.error("[updateBookingStatus] notifyUserBookingConfirmed failed:", err),
      );
    } else if (newStatus === BookingStatus.REJECTED) {
      notifyUserBookingCancelled(notifyParams).catch((err) =>
        console.error("[updateBookingStatus] notifyUserBookingCancelled failed:", err),
      );
    } else if (newStatus === BookingStatus.COMPLETED) {
      notifyUserBookingCompleted(notifyParams).catch((err) =>
        console.error("[updateBookingStatus] notifyUserBookingCompleted failed:", err),
      );
      // Запрос отзыва — отправляем сразу после завершения
      // TODO: когда появится /me/bookings/:id, обновить ctaAction в notifyUserBookingFeedbackRequest
      notifyUserBookingFeedbackRequest(notifyParams).catch((err) =>
        console.error("[updateBookingStatus] notifyUserBookingFeedbackRequest failed:", err),
      );
    }
  }

  return mapBooking(updated);
}
