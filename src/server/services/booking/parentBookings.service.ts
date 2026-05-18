/**
 * Parent Bookings Service
 *
 * Загружает заявки пользователя для страницы /me/bookings.
 * Consumer-facing — не содержит бизнес-данных (телефон, email клиента).
 */

import prisma from "@/lib/prisma";
import { BookingStatus } from "@prisma/client";
import { buildBookingDisplay } from "./booking.formatters";
import type { BookingDisplay } from "./booking.types";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ParentBookingItem {
  id: string;
  status: BookingStatus;
  createdAt: string;
  display: BookingDisplay;

  // Cover image (from offer/activity/place)
  coverImageUrl: string | null;

  // Publication refs for CTA links
  offerId: string | null;
  activityId: string | null;
  placeId: string | null;
  offer: { id: string; title: string; slug: string | null } | null;
  activity: { id: string; title: string; slug: string | null } | null;
  place: { id: string; title: string; slug: string | null } | null;

  // Business info
  businessName: string | null;

  // Camp shift
  campShiftId: string | null;
  campShiftTitle: string | null;
  campShiftDateFrom: string | null;
  campShiftDateTo: string | null;

  // Child info
  childName: string | null;
  childAge: number | null;

  // Date/time
  requestedDate: string | null;
  requestedTime: string | null;

  // Feedback
  hasFeedback: boolean;
  feedbackRating: number | null;

  // Timestamps for sorting
  completedAt: string | null;
  rejectedAt: string | null;
}

export interface ParentBookingsResult {
  active: ParentBookingItem[];    // NEW + CONFIRMED
  completed: ParentBookingItem[]; // COMPLETED
  cancelled: ParentBookingItem[]; // REJECTED + CANCELLED
}

// ─── Query ────────────────────────────────────────────────────────────────────

const PARENT_BOOKING_SELECT = {
  id: true,
  status: true,
  createdAt: true,
  completedAt: true,
  rejectedAt: true,

  offerId: true,
  activityId: true,
  placeId: true,
  offer: { select: { id: true, title: true, slug: true, coverImage: true } },
  activity: { select: { id: true, title: true, slug: true, coverImageUrl: true } },
  place: {
    select: {
      id: true,
      title: true,
      slug: true,
      images: {
        select: { url: true },
        orderBy: { sortOrder: "asc" },
        take: 1,
      },
    },
  },

  campShiftId: true,
  campShiftTitle: true,
  campShiftDateFrom: true,
  campShiftDateTo: true,

  childName: true,
  childAge: true,

  requestedDate: true,
  requestedTime: true,
  session: { select: { id: true, startsAt: true } },

  business: { select: { name: true } },
  feedback: { select: { rating: true } },
} as const;

function mapRow(raw: {
  id: string;
  status: BookingStatus;
  createdAt: Date;
  completedAt: Date | null;
  rejectedAt: Date | null;
  offerId: string | null;
  activityId: string | null;
  placeId: string | null;
  offer: { id: string; title: string; slug: string | null; coverImage: string | null } | null;
  activity: { id: string; title: string; slug: string | null; coverImageUrl: string | null } | null;
  place:
    | {
        id: string;
        title: string;
        slug: string | null;
        images: Array<{ url: string }>;
      }
    | null;
  campShiftId: string | null;
  campShiftTitle: string | null;
  campShiftDateFrom: Date | null;
  campShiftDateTo: Date | null;
  childName: string | null;
  childAge: number | null;
  requestedDate: Date | null;
  requestedTime: string | null;
  session: { id: string; startsAt: Date } | null;
  business: { name: string } | null;
  feedback: { rating: number } | null;
}): ParentBookingItem {
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
    customerName: "",
    requestedDate,
    requestedTime: raw.requestedTime,
    session,
  });

  const coverImageUrl =
    raw.offer?.coverImage ??
    raw.activity?.coverImageUrl ??
    raw.place?.images[0]?.url ??
    null;

  return {
    id: raw.id,
    status: raw.status,
    createdAt: raw.createdAt.toISOString(),
    completedAt: raw.completedAt?.toISOString() ?? null,
    rejectedAt: raw.rejectedAt?.toISOString() ?? null,
    display,
    coverImageUrl,
    offerId: raw.offerId,
    activityId: raw.activityId,
    placeId: raw.placeId,
    offer: raw.offer ? { id: raw.offer.id, title: raw.offer.title, slug: raw.offer.slug } : null,
    activity: raw.activity ? { id: raw.activity.id, title: raw.activity.title, slug: raw.activity.slug } : null,
    place: raw.place ? { id: raw.place.id, title: raw.place.title, slug: raw.place.slug } : null,
    businessName: raw.business?.name ?? null,
    campShiftId: raw.campShiftId,
    campShiftTitle: raw.campShiftTitle,
    campShiftDateFrom,
    campShiftDateTo,
    childName: raw.childName,
    childAge: raw.childAge,
    requestedDate,
    requestedTime: raw.requestedTime,
    hasFeedback: raw.feedback !== null,
    feedbackRating: raw.feedback?.rating ?? null,
  };
}

export async function getParentBookings(userId: string): Promise<ParentBookingsResult> {
  const rows = await prisma.bookingRequest.findMany({
    where: { userId },
    select: PARENT_BOOKING_SELECT,
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  const items = rows.map(mapRow);

  const active = items
    .filter((b) => b.status === BookingStatus.NEW || b.status === BookingStatus.CONFIRMED)
    .sort((a, b) => {
      // CONFIRMED first, then NEW; within each group newest first
      if (a.status === BookingStatus.CONFIRMED && b.status !== BookingStatus.CONFIRMED) return -1;
      if (a.status !== BookingStatus.CONFIRMED && b.status === BookingStatus.CONFIRMED) return 1;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

  const completed = items
    .filter((b) => b.status === BookingStatus.COMPLETED)
    .sort((a, b) =>
      new Date(b.completedAt ?? b.createdAt).getTime() -
      new Date(a.completedAt ?? a.createdAt).getTime(),
    );

  const cancelled = items
    .filter(
      (b) => b.status === BookingStatus.REJECTED || b.status === BookingStatus.CANCELLED,
    )
    .sort((a, b) =>
      new Date(b.rejectedAt ?? b.createdAt).getTime() -
      new Date(a.rejectedAt ?? a.createdAt).getTime(),
    );

  return { active, completed, cancelled };
}
