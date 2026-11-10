import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/server";
import { getMyBusiness } from "@/server/business/getMyBusiness";
import { createManualBooking, BookingNotFoundError, BookingValidationError, manualRequestOfferWhere, manualScheduledOfferWhere } from "@/server/services/booking/booking.service";
import { getPublicActivityDetailWhere, getPublicPublishedOfferWhere, getPublicPublishedPlaceWhere } from "@/server/public/publicContentVisibility";
import { eventBookingSlotKey, getEventBookingSchedule } from "@/lib/event/eventBookingSchedule";
import { getLocalDateKey } from "@/lib/date/localDateKey";
import { SlotReservationError } from "@/server/offers/reserveSlot";
import { parsePriceData } from "@/lib/priceItems";
import { formatHHMM } from "@/lib/formatters/date";

const publicationType = z.enum(["EVENT", "OFFER", "PLACE"]);
const date = z.iso.date();
const time = z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/);
const bodySchema = z.object({
  publicationType,
  publicationId: z.string().min(1).max(128),
  selectedSessionId: z.string().min(1).max(128).optional(),
  requestedDate: date.optional(),
  requestedTime: time.optional(),
  customerName: z.string().trim().min(2).max(120),
  customerPhone: z.string().trim().min(7).max(20),
  customerEmail: z.email().max(254).optional(),
  customerComment: z.string().trim().max(500).optional(),
  adultsCount: z.number().int().min(0).max(100),
  childrenCount: z.number().int().min(0).max(100),
  status: z.enum(["NEW", "CONFIRMED"]).default("CONFIRMED"),
  requestKey: z.uuid(),
  offerSlot: z.object({
    startsAt: z.iso.datetime(), endsAt: z.iso.datetime(),
    groupId: z.string().max(128).optional(), tariffId: z.string().max(128).optional(), unitId: z.string().max(128).optional(),
  }).optional(),
}).refine((data) => (!data.offerSlot || data.publicationType === "OFFER") && (!data.requestedTime || data.requestedDate));
const eventModes = ["REQUEST_ONLY", "USE_PUBLICATION_SLOTS", "USE_PUBLICATION_DATES"] as const;
const privateHeaders = { "Cache-Control": "private, no-store" };

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Войдите в кабинет" }, { status: 401 });
  const business = await getMyBusiness(user.id);
  if (!business || business.operationalStatus !== "ACTIVE") {
    return NextResponse.json({ error: "Бизнес недоступен" }, { status: 403 });
  }
  const params = request.nextUrl.searchParams;
  const type = publicationType.safeParse(params.get("type"));
  if (!type.success) return NextResponse.json({ error: "Выберите тип публикации" }, { status: 400 });
  const eventWhere: Prisma.ActivityWhereInput = {
    ...getPublicActivityDetailWhere(), type: "EVENT", businessId: business.id,
    bookingEnabled: true, bookingMode: { in: [...eventModes] },
  };
  const eventId = params.get("eventId");
  if (type.data === "EVENT" && eventId) {
    const now = new Date();
    const event = await prisma.activity.findFirst({
      where: { ...eventWhere, id: eventId },
      select: {
        bookingMode: true, scheduleJson: true,
        sessions: {
          where: { withdrawnAt: null, startsAt: { gt: now }, OR: [{ isSaleOpen: null }, { isSaleOpen: true }] },
          orderBy: [{ startsAt: "asc" }, { id: "asc" }], take: 100,
          select: { id: true, startsAt: true },
        },
      },
    });
    if (!event) return NextResponse.json({ error: "Событие недоступно" }, { status: 404 });
    const configured = getEventBookingSchedule(event.scheduleJson);
    const schedule = event.scheduleJson as Record<string, unknown> | null;
    const hasWizardSchedule = schedule?.participationMode === "time-slots" || schedule?.participationMode === "simple-booking";
    const today = getLocalDateKey(now);
    const dates = event.bookingMode === "USE_PUBLICATION_DATES"
      ? hasWizardSchedule
        ? [...configured.values()].filter((entry) => !entry.startTime && entry.date >= today && entry.capacity !== 0).map((entry) => entry.date).sort()
        : [...new Set(event.sessions.map((session) => getLocalDateKey(session.startsAt)))]
      : [];
    const slots = event.bookingMode === "USE_PUBLICATION_SLOTS" ? event.sessions.flatMap((session) => {
      const date = getLocalDateKey(session.startsAt);
      const time = formatHHMM(session.startsAt);
      const key = eventBookingSlotKey(date, time);
      const config = configured.get(key);
      if ((hasWizardSchedule && !config) || config?.capacity === 0) return [];
      if (hasWizardSchedule) configured.delete(key);
      return [{ id: session.id, date, time }];
    }) : [];
    return NextResponse.json({ mode: event.bookingMode, dates, slots }, { headers: privateHeaders });
  }

  const offerId = params.get("offerId");
  if (type.data === "OFFER" && offerId) {
    const offer = await prisma.offer.findFirst({
      where: { ...getPublicPublishedOfferWhere(), ...manualScheduledOfferWhere, id: offerId, place: { ownerBusinessId: business.id } },
      select: {
        priceItems: true,
        offerBooking: { select: { timezone: true } },
        bookingUnitOffers: {
          where: { bookingUnit: { businessId: business.id, status: "ACTIVE" } },
          take: 100,
          select: { bookingUnit: { select: { id: true, name: true } } },
        },
      },
    });
    if (!offer?.offerBooking) return NextResponse.json({ error: "Предложение недоступно" }, { status: 404 });
    return NextResponse.json({
      timezone: offer.offerBooking.timezone,
      tariffs: parsePriceData(offer.priceItems).items.map(({ id, label }) => ({ id, label })),
      units: Object.fromEntries(offer.bookingUnitOffers.map(({ bookingUnit }) => [bookingUnit.id, bookingUnit.name])),
    }, { headers: privateHeaders });
  }

  const search = params.get("q")?.trim().slice(0, 100);
  const where = { title: search ? { contains: search, mode: "insensitive" as const } : undefined, bookingEnabled: true };
  const list = { select: { id: true, title: true }, orderBy: [{ title: "asc" as const }, { id: "asc" as const }], take: 30 };
  const items = type.data === "EVENT" ? await prisma.activity.findMany({ ...list, where: { ...eventWhere, ...where } })
    : type.data === "PLACE" ? await prisma.place.findMany({
      ...list, where: { ...getPublicPublishedPlaceWhere(), ...where, ownerBusinessId: business.id },
    }) : await prisma.offer.findMany({
      ...list,
      select: { ...list.select, offerBooking: { select: { id: true } } },
      where: {
        ...getPublicPublishedOfferWhere(), ...where, place: { ownerBusinessId: business.id },
        AND: [
          ...(getPublicPublishedOfferWhere().AND as Prisma.OfferWhereInput[]),
          { OR: [manualRequestOfferWhere, manualScheduledOfferWhere] },
        ],
      },
    });
  return NextResponse.json({ items }, { headers: privateHeaders });
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Войдите в кабинет" }, { status: 401 });
  const business = await getMyBusiness(user.id);
  if (!business || business.operationalStatus !== "ACTIVE") {
    return NextResponse.json({ error: "Бизнес недоступен" }, { status: 403 });
  }

  try {
    const parsed = bodySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Проверьте заполнение формы" }, { status: 400 });
    const { requestKey, ...data } = parsed.data;
    const result = await createManualBooking(data, { businessId: business.id, actorId: user.id, requestKey });
    return NextResponse.json(result, { status: 201, headers: privateHeaders });
  } catch (error) {
    if (error instanceof BookingNotFoundError) return NextResponse.json({ error: error.message }, { status: 404 });
    if (error instanceof SlotReservationError) return NextResponse.json({ error: error.message }, { status: 409 });
    if (error instanceof BookingValidationError) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ error: "Не удалось сохранить запись" }, { status: 500 });
  }
}
