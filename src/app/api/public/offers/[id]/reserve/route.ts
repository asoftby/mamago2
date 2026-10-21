import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/server";
import { checkRateLimit } from "@/lib/security/rateLimit";
import { getTrustedClientIp } from "@/lib/security/clientIp";
import {
  BookingNotFoundError,
  BookingValidationError,
  createPublicClassSlotBooking,
} from "@/server/services/booking/booking.service";
import { SlotReservationError } from "@/server/offers/reserveSlot";

const reservationSchema = z.object({
  startsAt: z.string().datetime({ offset: true }),
  endsAt: z.string().datetime({ offset: true }),
  seats: z.number().int().min(1).max(100).default(1),
  customerName: z.string().trim().min(1).max(150),
  customerPhone: z.string().trim().min(7).max(20),
  customerEmail: z.string().email().optional(),
  customerComment: z.string().max(2000).optional(),
  planItemId: z.string().min(1).optional(),
  childId: z.string().min(1).optional(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ip = getTrustedClientIp(request) ?? "unknown";
  const limit = await checkRateLimit(`class_reserve:${ip}`, 10, 10 * 60_000);
  if (!limit.allowed) return NextResponse.json({ error: "Слишком много попыток" }, { status: 429 });

  const payload = reservationSchema.safeParse(await request.json().catch(() => null));
  if (!payload.success) {
    return NextResponse.json({ error: "Некорректные данные записи", details: payload.error.issues }, { status: 400 });
  }

  const { id } = await params;
  const user = await getCurrentUser();
  try {
    const result = await createPublicClassSlotBooking({
      offerId: id,
      startsAt: new Date(payload.data.startsAt),
      endsAt: new Date(payload.data.endsAt),
      seats: payload.data.seats,
      customerName: payload.data.customerName,
      customerPhone: payload.data.customerPhone,
      customerEmail: payload.data.customerEmail,
      customerComment: payload.data.customerComment,
      planItemId: payload.data.planItemId,
      childId: payload.data.childId,
      userId: user?.id ?? null,
    });
    return NextResponse.json({
      bookingId: result.bookingId,
      status: "NEW",
      holdUntil: result.holdUntil.toISOString(),
    }, { status: 201 });
  } catch (error) {
    if (error instanceof BookingNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    if (error instanceof BookingValidationError) {
      return NextResponse.json({ error: error.message, field: error.field }, { status: 400 });
    }
    if (error instanceof SlotReservationError) {
      return NextResponse.json({ error: error.message, code: error.code }, {
        status: error.code === "SLOT_UNAVAILABLE" ? 409 : error.code === "OFFER_UNAVAILABLE" ? 404 : 400,
      });
    }
    console.error("[class-reserve] request failed", error);
    return NextResponse.json({ error: "Не удалось создать запись" }, { status: 500 });
  }
}
