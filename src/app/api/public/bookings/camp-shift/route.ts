/**
 * POST /api/public/bookings/camp-shift
 *
 * Публичный endpoint для записи на смену лагеря.
 * Авторизация не требуется; если пользователь авторизован — userId привязывается.
 *
 * Body:
 * {
 *   offerId:       string          // ID предложения
 *   campShiftId:   string          // ID смены из Offer.campSessions
 *   customerName:  string          // Имя родителя/контактного лица
 *   customerPhone: string          // Телефон
 *   customerEmail?: string         // Email (опционально)
 *   childName?:    string          // Имя ребёнка
 *   childAge?:     number          // Возраст ребёнка
 *   comment?:      string          // Комментарий
 * }
 *
 * Response 201:
 * { ok: true, bookingId: string }
 *
 * Response 400/404:
 * { ok: false, error: string, field?: string }
 */

import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/server";
import {
  createCampShiftBooking,
  BookingValidationError,
  BookingNotFoundError,
} from "@/server/services/booking/booking.service";

// ─── Schema ───────────────────────────────────────────────────────────────────

const campShiftBookingSchema = z.object({
  offerId: z.string().min(1, "offerId обязателен"),
  campShiftId: z.string().min(1, "campShiftId обязателен"),
  customerName: z.string().min(1, "Имя обязательно").max(120),
  customerPhone: z.string().min(7, "Телефон обязателен").max(30),
  customerEmail: z.string().email("Некорректный email").optional().or(z.literal("")),
  childName: z.string().max(120).optional(),
  childAge: z.number().int().min(0).max(18).optional(),
  comment: z.string().max(1000).optional(),
});

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    // Авторизация опциональна
    const user = await getCurrentUser().catch(() => null);

    const body: unknown = await request.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json(
        { ok: false, error: "Некорректный JSON" },
        { status: 400 },
      );
    }

    // Валидация входных данных
    const parsed = campShiftBookingSchema.safeParse(body);
    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0];
      return NextResponse.json(
        {
          ok: false,
          error: firstIssue?.message ?? "Ошибка валидации",
          field: firstIssue?.path[0] ?? undefined,
        },
        { status: 400 },
      );
    }

    const data = parsed.data;

    const result = await createCampShiftBooking({
      offerId: data.offerId,
      campShift: { id: data.campShiftId },
      customerName: data.customerName,
      customerPhone: data.customerPhone,
      customerEmail: data.customerEmail || null,
      childName: data.childName || null,
      childAge: data.childAge ?? null,
      comment: data.comment || null,
      userId: user?.id ?? null,
    });

    return NextResponse.json(
      { ok: true, bookingId: result.bookingId },
      { status: 201 },
    );
  } catch (err) {
    if (err instanceof BookingValidationError) {
      return NextResponse.json(
        { ok: false, error: err.message, field: err.field },
        { status: 400 },
      );
    }
    if (err instanceof BookingNotFoundError) {
      return NextResponse.json(
        { ok: false, error: err.message },
        { status: 404 },
      );
    }

    console.error("[POST /api/public/bookings/camp-shift]", err);
    Sentry.captureException(err, {
      tags: {
        area: "booking",
        flow: "camp_shift",
        stage: "api_route",
      },
    });
    return NextResponse.json(
      { ok: false, error: "Внутренняя ошибка сервера" },
      { status: 500 },
    );
  }
}
