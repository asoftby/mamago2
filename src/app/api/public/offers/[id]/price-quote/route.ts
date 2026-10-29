import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { parsePriceData } from "@/lib/priceItems";
import { checkRateLimit } from "@/lib/security/rateLimit";
import { getTrustedClientIp } from "@/lib/security/clientIp";
import { getPublicPublishedOfferWhere } from "@/server/public/publicContentVisibility";
import { calculateBookingPrice, BookingPriceError } from "@/server/offers/bookingPrice";
import { assertBookingDuration, durationChoices } from "@/server/offers/bookingDuration";

const requestSchema = z.object({
  startsAt: z.string().datetime({ offset: true }),
  endsAt: z.string().datetime({ offset: true }),
  classGroupId: z.string().min(1).max(128).optional(),
  classTariffId: z.string().min(1).max(128).optional(),
  selectedOptionIds: z.array(z.string().min(1).max(128)).max(20).optional(),
  seats: z.number().int().min(1).max(100).default(1),
}).strict();

/** Price-only preview: no allocation, charge, or guarantee of a free slot. */
export async function POST(request: NextRequest, { params }: {
  params: Promise<{ id: string }>;
}) {
  const ip = getTrustedClientIp(request) ?? "unknown";
  const limit = await checkRateLimit(`offer_quote:${ip}`, 30, 10 * 60_000);
  if (!limit.allowed) return NextResponse.json({ error: "Слишком много запросов" }, { status: 429 });
  const input = requestSchema.safeParse(await request.json().catch(() => null));
  if (!input.success) return NextResponse.json({ error: "Некорректные параметры расчёта" }, { status: 400 });
  const from = new Date(input.data.startsAt);
  const to = new Date(input.data.endsAt);
  const durationMinutes = (to.getTime() - from.getTime()) / 60_000;
  if (!Number.isInteger(durationMinutes) || durationMinutes < 1 || durationMinutes > 7 * 24 * 60) {
    return NextResponse.json({ error: "Некорректная продолжительность" }, { status: 400 });
  }
  const { id } = await params;
  const offer = await prisma.offer.findFirst({
    where: { id, ...getPublicPublishedOfferWhere(),
      bookingEnabled: true, bookingMode: { in: ["USE_PUBLICATION_DATES", "USE_PUBLICATION_SLOTS"] } },
    select: {
      id: true, currency: true, priceItems: true,
      place: { select: { ownerBusinessId: true } },
      classGroups: { include: { tariffs: true } },
      offerBooking: { select: { basePriceByn: true, options: true, durationMin: true, scheduleKind: true, maxExtensionHours: true, extensionHourPriceByn: true, extensionDiscountPercent: true } },
    },
  });
  if (!offer?.place?.ownerBusinessId || !offer.offerBooking) {
    return NextResponse.json({ error: "Предложение недоступно" }, { status: 404 });
  }
  if (offer.offerBooking.scheduleKind === "ON_REQUEST_WINDOWS") {
    try {
      assertBookingDuration({
        scheduleKind: offer.offerBooking.scheduleKind,
        durationMin: offer.offerBooking.durationMin,
        maxExtensionHours: offer.offerBooking.maxExtensionHours,
        extensionHourPriceByn: offer.offerBooking.extensionHourPriceByn?.toString() ?? null,
        extensionDiscountPercent: offer.offerBooking.extensionDiscountPercent,
        hasClassGroups: offer.classGroups.some(group => group.active),
      }, durationMinutes);
    } catch {
      return NextResponse.json({ error: "Продолжительность недоступна" }, { status: 422 });
    }
  } else if (offer.offerBooking.durationMin !== null &&
      durationMinutes !== offer.offerBooking.durationMin) {
    return NextResponse.json({ error: "Продолжительность недоступна" }, { status: 422 });
  }
  const groups = offer.classGroups.filter(group => group.active);
  const group = input.data.classGroupId
    ? groups.find(item => item.id === input.data.classGroupId) : null;
  if ((groups.length > 0 && !group) || (input.data.classGroupId && !group)) {
    return NextResponse.json({ error: "Выберите действующую группу" }, { status: 422 });
  }
  const structuredTariffs = group?.tariffs.filter(item => item.active) ?? [];
  const legacyTariffs = parsePriceData(offer.priceItems).items;
  const tariff = structuredTariffs.length
    ? structuredTariffs.find(item => item.id === input.data.classTariffId)
    : !group ? legacyTariffs.find(item => item.id === input.data.classTariffId) : null;
  if ((structuredTariffs.length > 0 || (!group && legacyTariffs.length > 0)) && !tariff ||
      input.data.classTariffId && !tariff) {
    return NextResponse.json({ error: "Тариф недоступен" }, { status: 422 });
  }
  try {
    const { snapshot, optionUnitIds } = calculateBookingPrice({
      currency: offer.currency, seats: input.data.seats, durationMinutes,
      baseDurationMinutes: offer.offerBooking.durationMin ?? durationMinutes,
      extensionHourPriceByn: offer.offerBooking.extensionHourPriceByn?.toString() ?? null,
      extensionDiscountPercent: offer.offerBooking.extensionDiscountPercent,
      basePriceByn: offer.offerBooking.basePriceByn?.toString() ?? null,
      tariff: tariff ? {
        id: tariff.id, title: "title" in tariff ? tariff.title : tariff.label,
        price: tariff.price, unit: tariff.unit,
      } : null,
      options: offer.offerBooking.options.map(option => ({
        id: option.id, title: option.title, mode: option.mode,
        priceByn: option.priceByn.toString(), active: option.active,
        bookingUnitId: option.bookingUnitId,
      })),
      selectedOptionIds: input.data.selectedOptionIds,
    });
    if (optionUnitIds.length > 0 && groups.length > 0) {
      return NextResponse.json({ error: "Для групповых занятий ресурсные допуслуги недоступны" }, { status: 422 });
    }
    // Internal resource IDs are never returned to clients by the pricing endpoint.
    return NextResponse.json({
      quote: {
        ...snapshot,
        options: snapshot.options.map(({ bookingUnitId: _internal, ...publicOption }) => publicOption),
      },
      availabilityNotGuaranteed: true,
      finalPriceRequiresReservation: snapshot.status !== "FIXED",
    }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    if (error instanceof BookingPriceError) {
      return NextResponse.json({ error: error.message }, { status: 422 });
    }
    console.error("[offer-price-quote]", error);
    return NextResponse.json({ error: "Не удалось рассчитать стоимость" }, { status: 500 });
  }
}

/**
 * Public selection catalog: only optional / included items, never resource IDs,
 * standalone products, unpublished offers, or private B2B data.
 */
export async function GET(_request: NextRequest, { params }: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const offer = await prisma.offer.findFirst({
    where: { id, ...getPublicPublishedOfferWhere(), bookingEnabled: true,
      bookingMode: { in: ["USE_PUBLICATION_DATES", "USE_PUBLICATION_SLOTS"] } },
    select: { currency: true, place: { select: { ownerBusinessId: true } },
      classGroups: { where: { active: true }, select: { id: true } },
      offerBooking: { select: {
        durationMin: true, maxExtensionHours: true, extensionHourPriceByn: true,
        extensionDiscountPercent: true,
        scheduleKind: true, options: { where: { active: true },
        orderBy: { position: "asc" }, select: {
          id: true, title: true, mode: true, priceByn: true, bookingUnitId: true,
        } } } },
    },
  });
  if (!offer?.place?.ownerBusinessId || !offer.offerBooking) {
    return NextResponse.json({ error: "Предложение недоступно" }, { status: 404 });
  }
  // A group session has capacity seats, not an exclusive resource slot.
  // Never advertise an optional resource the class reservation cannot hold.
  const options = offer.currency === "BYN"
    ? offer.offerBooking.options.filter(option =>
      option.mode !== "STANDALONE" &&
      !(option.bookingUnitId && (offer.classGroups.length > 0 ||
        offer.offerBooking?.scheduleKind !== "ON_REQUEST_WINDOWS"))).map(option => ({
        id: option.id, title: option.title, mode: option.mode,
        priceByn: option.priceByn.toFixed(2),
      }))
    : [];
  const durations = durationChoices({
    scheduleKind: offer.offerBooking.scheduleKind,
    durationMin: offer.offerBooking.durationMin,
    maxExtensionHours: offer.offerBooking.maxExtensionHours,
    extensionHourPriceByn: offer.offerBooking.extensionHourPriceByn?.toString() ?? null,
    extensionDiscountPercent: offer.offerBooking.extensionDiscountPercent,
    hasClassGroups: offer.classGroups.length > 0,
  });
  return NextResponse.json({ options, currency: offer.currency, durationOptionsMinutes: durations },
    { headers: { "Cache-Control": "private, no-store" } });
}
