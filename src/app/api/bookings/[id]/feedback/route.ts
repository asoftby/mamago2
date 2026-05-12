/**
 * POST /api/bookings/[id]/feedback
 *
 * Оставить отзыв (1–5 звёзд) после завершённой заявки.
 * Доступно авторизованным и анонимным пользователям.
 *
 * Body: { rating: 1..5, comment?: string }
 *
 * Response 201: { id, bookingId, rating, comment, createdAt }
 * Response 400: validation error
 * Response 403: not eligible (not completed / wrong user)
 * Response 409: feedback already exists
 * Response 429: rate limit exceeded
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/server";
import {
  createBookingFeedback,
  FeedbackValidationError,
  FeedbackNotEligibleError,
  FeedbackAlreadyExistsError,
  FeedbackRateLimitError,
} from "@/server/services/booking/bookingFeedback.service";

const feedbackSchema = z.object({
  rating: z.number().int().min(1).max(5),
  comment: z.string().max(1000).optional().nullable(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    // Auth is optional — anonymous feedback allowed
    const user = await getCurrentUser().catch(() => null);

    const { id: bookingId } = await params;

    const body: unknown = await request.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Некорректный JSON" }, { status: 400 });
    }

    const parsed = feedbackSchema.safeParse(body);
    if (!parsed.success) {
      const first = parsed.error.issues[0];
      return NextResponse.json(
        { error: first?.message ?? "Ошибка валидации", field: first?.path[0] },
        { status: 400 },
      );
    }

    const result = await createBookingFeedback({
      bookingId,
      userId: user?.id ?? null,
      rating: parsed.data.rating,
      comment: parsed.data.comment ?? null,
    });

    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    if (err instanceof FeedbackValidationError) {
      return NextResponse.json(
        { error: err.message, field: err.field },
        { status: 400 },
      );
    }
    if (err instanceof FeedbackNotEligibleError) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    if (err instanceof FeedbackAlreadyExistsError) {
      return NextResponse.json({ error: err.message }, { status: 409 });
    }
    if (err instanceof FeedbackRateLimitError) {
      return NextResponse.json({ error: err.message }, { status: 429 });
    }
    console.error("[POST /api/bookings/[id]/feedback]", err);
    return NextResponse.json({ error: "Внутренняя ошибка сервера" }, { status: 500 });
  }
}
