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
import { publicActivityPath } from "@/lib/business/eventPublicLink";
import { getOfferPublicPath } from "@/lib/offers/offerPublicUrl";
import { getPlacePublicUrl } from "@/lib/placePublicUrl";
import { resolveInstagramProfileHref } from "@/lib/instagram/extractUsername";

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
  publicHref: string | null;
  organizerName: string | null;
  organizerPhone: string | null;
  organizerWebsite: string | null;
  organizerInstagramUrl: string | null;
  organizerTelegramUrl: string | null;
  organizerMessageUrl: string | null;
  address: string | null;
  mapUrl: string | null;

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

type ContactSocialLink = {
  network?: string;
  url?: string;
};

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
  activity: {
    select: {
      id: true,
      title: true,
      slug: true,
      coverImageUrl: true,
      bookingPhone: true,
      organizer: { select: { name: true, phone: true, website: true, instagram: true } },
      place: {
        select: {
          formattedAddr: true,
          shortAddress: true,
          lat: true,
          lng: true,
          googleMapsUri: true,
          phone: true,
          website: true,
          instagramUrl: true,
          instagramHandle: true,
          city: { select: { slug: true } },
        },
      },
    },
  },
  place: {
    select: {
      id: true,
      title: true,
      slug: true,
      status: true,
      formattedAddr: true,
      shortAddress: true,
      lat: true,
      lng: true,
      googleMapsUri: true,
      bookingPhone: true,
      phone: true,
      website: true,
      instagramUrl: true,
      instagramHandle: true,
      images: {
        select: { url: true },
        orderBy: { sortOrder: "asc" },
        take: 1,
      },
    },
  },
  offer: {
    select: {
      id: true,
      title: true,
      slug: true,
      kind: true,
      campProgramType: true,
      coverImage: true,
      bookingPhone: true,
      contactPhone: true,
      contactWebsite: true,
      contactSocialLinks: true,
      place: {
        select: {
          title: true,
          formattedAddr: true,
          shortAddress: true,
          lat: true,
          lng: true,
          googleMapsUri: true,
          phone: true,
          website: true,
          instagramUrl: true,
          instagramHandle: true,
          city: { select: { slug: true } },
        },
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

  business: { select: { name: true, phone: true } },
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
  offer:
    | {
        id: string;
        title: string;
        slug: string | null;
        kind: string;
        campProgramType: string | null;
        coverImage: string | null;
        bookingPhone: string | null;
        contactPhone: string | null;
        contactWebsite: string | null;
        contactSocialLinks: unknown;
        place: {
          title: string;
          formattedAddr: string | null;
          shortAddress: string | null;
          lat: number | null;
          lng: number | null;
          googleMapsUri: string | null;
          phone: string | null;
          website: string | null;
          instagramUrl: string | null;
          instagramHandle: string | null;
          city: { slug: string } | null;
        } | null;
      }
    | null;
  activity:
    | {
        id: string;
        title: string;
        slug: string | null;
        coverImageUrl: string | null;
        bookingPhone: string | null;
        organizer: {
          name: string;
          phone: string | null;
          website: string | null;
          instagram: string | null;
        } | null;
        place: {
          formattedAddr: string | null;
          shortAddress: string | null;
          lat: number | null;
          lng: number | null;
          googleMapsUri: string | null;
          phone: string | null;
          website: string | null;
          instagramUrl: string | null;
          instagramHandle: string | null;
          city: { slug: string } | null;
        } | null;
      }
    | null;
  place:
    | {
        id: string;
        title: string;
        slug: string | null;
        status: string;
        formattedAddr: string | null;
        shortAddress: string | null;
        lat: number | null;
        lng: number | null;
        googleMapsUri: string | null;
        bookingPhone: string | null;
        phone: string | null;
        website: string | null;
        instagramUrl: string | null;
        instagramHandle: string | null;
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
  business: { name: string; phone: string | null } | null;
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

  const offerSocialLinks = Array.isArray(raw.offer?.contactSocialLinks)
    ? raw.offer?.contactSocialLinks.filter(
        (item): item is ContactSocialLink =>
          typeof item === "object" && item !== null,
      )
    : [];
  const offerTelegramUrl =
    offerSocialLinks.find((item) => item.network === "telegram")?.url?.trim() ??
    null;
  const offerInstagramUrl =
    offerSocialLinks.find((item) => item.network === "instagram")?.url?.trim() ??
    null;
  const activityInstagramUrl = resolveInstagramProfileHref(
    raw.activity?.place?.instagramUrl,
    raw.activity?.place?.instagramHandle,
  );
  const placeInstagramUrl = resolveInstagramProfileHref(
    raw.place?.instagramUrl,
    raw.place?.instagramHandle,
  );
  const organizerInstagramUrl = resolveInstagramProfileHref(
    raw.activity?.organizer?.instagram,
    null,
  );
  const address =
    raw.offer?.place?.formattedAddr ??
    raw.activity?.place?.formattedAddr ??
    raw.place?.formattedAddr ??
    raw.offer?.place?.shortAddress ??
    raw.activity?.place?.shortAddress ??
    raw.place?.shortAddress ??
    null;
  const mapUrl =
    raw.offer?.place?.googleMapsUri ??
    raw.activity?.place?.googleMapsUri ??
    raw.place?.googleMapsUri ??
    null;
  const publicHref = raw.activity
    ? publicActivityPath(
        raw.activity.id,
        raw.activity.place?.city?.slug ?? null,
        raw.activity.slug ?? null,
      )
    : raw.offer && raw.offer.place?.city?.slug
      ? getOfferPublicPath(raw.offer, raw.offer.place.city.slug)
      : raw.place
        ? getPlacePublicUrl(raw.place)
        : null;
  const organizerName =
    raw.activity?.organizer?.name ??
    raw.business?.name ??
    raw.offer?.place?.title ??
    raw.place?.title ??
    null;
  const organizerPhone =
    raw.offer?.contactPhone ??
    raw.offer?.bookingPhone ??
    raw.activity?.bookingPhone ??
    raw.activity?.organizer?.phone ??
    raw.place?.bookingPhone ??
    raw.place?.phone ??
    raw.offer?.place?.phone ??
    raw.activity?.place?.phone ??
    raw.business?.phone ??
    null;
  const organizerWebsite =
    raw.offer?.contactWebsite ??
    raw.activity?.organizer?.website ??
    raw.place?.website ??
    raw.offer?.place?.website ??
    raw.activity?.place?.website ??
    null;
  const organizerTelegramUrl = offerTelegramUrl;
  const organizerInstagramResolved =
    offerInstagramUrl ||
    organizerInstagramUrl ||
    placeInstagramUrl ||
    activityInstagramUrl ||
    null;
  const organizerMessageUrl =
    organizerTelegramUrl ??
    organizerInstagramResolved ??
    organizerWebsite ??
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
    publicHref,
    organizerName,
    organizerPhone,
    organizerWebsite,
    organizerInstagramUrl: organizerInstagramResolved,
    organizerTelegramUrl,
    organizerMessageUrl,
    address,
    mapUrl,
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
