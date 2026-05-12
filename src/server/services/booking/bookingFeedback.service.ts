/**
 * Booking Feedback Service
 *
 * Lightweight 1–5 star feedback после завершённых заявок.
 *
 * ─── Rules ───────────────────────────────────────────────────────────────────
 *   - Только для COMPLETED bookings (completedAt != null)
 *   - Один feedback на booking (UNIQUE constraint)
 *   - Rating: 1–5 (validated at DB + application layer)
 *   - Comment: optional, max 1000 chars
 *   - Anti-spam: rate limit по userId (max 10 feedbacks за 24ч)
 *
 * ─── Reputation integration (future) ─────────────────────────────────────────
 *   averageRating и positiveRate могут позже:
 *   - усиливать reputation score
 *   - влиять на ranking boost
 *   - снижать stale penalties
 *   - формировать trust signals
 *   Сейчас — только aggregate metrics, не подключены к ranking.
 */

import prisma from "@/lib/prisma";
import { BookingStatus } from "@prisma/client";

// ─── Constants ────────────────────────────────────────────────────────────────

const MIN_RATING = 1;
const MAX_RATING = 5;
const MAX_COMMENT_LENGTH = 1000;

/** Anti-spam: max feedbacks per user per 24h */
const RATE_LIMIT_MAX = 10;
const RATE_LIMIT_WINDOW_HOURS = 24;

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CreateFeedbackInput {
  bookingId: string;
  userId: string | null;
  rating: number;
  comment?: string | null;
}

export interface FeedbackResult {
  id: string;
  bookingId: string;
  rating: number;
  comment: string | null;
  createdAt: string;
}

export interface FeedbackSummary {
  feedbackCount: number;
  averageRating: number | null;
  positiveRate: number;  // % of 4–5 star ratings (0–100)
  negativeRate: number;  // % of 1–2 star ratings (0–100)
}

// ─── Errors ───────────────────────────────────────────────────────────────────

export class FeedbackValidationError extends Error {
  constructor(
    public readonly field: string,
    message: string,
  ) {
    super(message);
    this.name = "FeedbackValidationError";
  }
}

export class FeedbackNotEligibleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FeedbackNotEligibleError";
  }
}

export class FeedbackAlreadyExistsError extends Error {
  constructor() {
    super("Отзыв для этой заявки уже оставлен");
    this.name = "FeedbackAlreadyExistsError";
  }
}

export class FeedbackRateLimitError extends Error {
  constructor() {
    super("Слишком много отзывов. Попробуйте позже.");
    this.name = "FeedbackRateLimitError";
  }
}

// ─── Validation ───────────────────────────────────────────────────────────────

function validateRating(rating: unknown): number {
  if (typeof rating !== "number" || !Number.isInteger(rating)) {
    throw new FeedbackValidationError("rating", "Оценка должна быть целым числом");
  }
  if (rating < MIN_RATING || rating > MAX_RATING) {
    throw new FeedbackValidationError(
      "rating",
      `Оценка должна быть от ${MIN_RATING} до ${MAX_RATING}`,
    );
  }
  return rating;
}

function validateComment(comment: unknown): string | null {
  if (comment === null || comment === undefined || comment === "") return null;
  if (typeof comment !== "string") {
    throw new FeedbackValidationError("comment", "Комментарий должен быть строкой");
  }
  const trimmed = comment.trim();
  if (trimmed.length > MAX_COMMENT_LENGTH) {
    throw new FeedbackValidationError(
      "comment",
      `Комментарий не должен превышать ${MAX_COMMENT_LENGTH} символов`,
    );
  }
  return trimmed || null;
}

// ─── Anti-spam rate limit ─────────────────────────────────────────────────────

async function checkRateLimit(userId: string): Promise<void> {
  const since = new Date();
  since.setHours(since.getHours() - RATE_LIMIT_WINDOW_HOURS);

  const count = await prisma.bookingFeedback.count({
    where: {
      userId,
      createdAt: { gte: since },
    },
  });

  if (count >= RATE_LIMIT_MAX) {
    throw new FeedbackRateLimitError();
  }
}

// ─── Create ───────────────────────────────────────────────────────────────────

/**
 * Создаёт feedback для завершённой заявки.
 *
 * Проверяет:
 * 1. Booking существует и принадлежит пользователю (если userId задан)
 * 2. Booking имеет статус COMPLETED
 * 3. Feedback ещё не оставлен
 * 4. Rate limit по userId
 * 5. Валидность rating и comment
 */
export async function createBookingFeedback(
  input: CreateFeedbackInput,
): Promise<FeedbackResult> {
  // ── Validate fields ──
  const rating = validateRating(input.rating);
  const comment = validateComment(input.comment);

  // ── Load booking ──
  const booking = await prisma.bookingRequest.findUnique({
    where: { id: input.bookingId },
    select: {
      id: true,
      status: true,
      completedAt: true,
      userId: true,
      feedback: { select: { id: true } },
    },
  });

  if (!booking) {
    throw new FeedbackNotEligibleError("Заявка не найдена");
  }

  // ── Eligibility: must be COMPLETED ──
  if (booking.status !== BookingStatus.COMPLETED || !booking.completedAt) {
    throw new FeedbackNotEligibleError(
      "Отзыв можно оставить только для завершённой заявки",
    );
  }

  // ── Ownership check (if user is authenticated) ──
  // Allow anonymous feedback (userId = null) for cases where user wasn't logged in at booking time
  if (input.userId && booking.userId && booking.userId !== input.userId) {
    throw new FeedbackNotEligibleError("Нет доступа к этой заявке");
  }

  // ── Deduplication ──
  if (booking.feedback) {
    throw new FeedbackAlreadyExistsError();
  }

  // ── Rate limit (only for authenticated users) ──
  if (input.userId) {
    await checkRateLimit(input.userId);
  }

  // ── Create ──
  const record = await prisma.bookingFeedback.create({
    data: {
      bookingId: input.bookingId,
      userId: input.userId ?? null,
      rating,
      comment,
    },
    select: {
      id: true,
      bookingId: true,
      rating: true,
      comment: true,
      createdAt: true,
    },
  });

  return {
    id: record.id,
    bookingId: record.bookingId,
    rating: record.rating,
    comment: record.comment,
    createdAt: record.createdAt.toISOString(),
  };
}

// ─── Aggregate ────────────────────────────────────────────────────────────────

/**
 * Возвращает aggregate feedback metrics для бизнеса.
 * Считает по всем завершённым заявкам бизнеса (без ограничения по периоду).
 *
 * Используется в:
 *   - business dashboard
 *   - reputation layer (future)
 *   - ranking boost (future)
 */
export async function getBusinessFeedbackSummary(
  businessId: string,
): Promise<FeedbackSummary> {
  const feedbacks = await prisma.bookingFeedback.findMany({
    where: {
      booking: { businessId },
    },
    select: { rating: true },
  });

  const count = feedbacks.length;

  if (count === 0) {
    return {
      feedbackCount: 0,
      averageRating: null,
      positiveRate: 0,
      negativeRate: 0,
    };
  }

  const sum = feedbacks.reduce((acc, f) => acc + f.rating, 0);
  const averageRating = Math.round((sum / count) * 10) / 10; // 1 decimal

  const positiveCount = feedbacks.filter((f) => f.rating >= 4).length;
  const negativeCount = feedbacks.filter((f) => f.rating <= 2).length;

  return {
    feedbackCount: count,
    averageRating,
    positiveRate: Math.round((positiveCount / count) * 100),
    negativeRate: Math.round((negativeCount / count) * 100),
  };
}

/**
 * Проверяет, оставил ли пользователь feedback для конкретной заявки.
 * Используется для показа/скрытия feedback card на клиенте.
 */
export async function getBookingFeedbackStatus(bookingId: string): Promise<{
  hasFeedback: boolean;
  rating: number | null;
}> {
  const feedback = await prisma.bookingFeedback.findUnique({
    where: { bookingId },
    select: { rating: true },
  });

  return {
    hasFeedback: feedback !== null,
    rating: feedback?.rating ?? null,
  };
}
