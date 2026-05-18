/**
 * Booking Activity Service
 *
 * Создание и чтение событий истории заявки (timeline).
 * Все записи создаются fire-and-forget — не блокируют основной flow.
 */

import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import type { BookingActivityType, BookingActivityActorType } from "@prisma/client";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface BookingActivityRecord {
  id: string;
  bookingId: string;
  type: BookingActivityType;
  actorType: BookingActivityActorType;
  actorId: string | null;
  payload: Prisma.JsonValue | null;
  createdAt: string;
}

export interface CreateActivityInput {
  bookingId: string;
  type: BookingActivityType;
  actorType?: BookingActivityActorType;
  actorId?: string | null;
  payload?: Prisma.InputJsonValue | null;
}

// ─── Create ───────────────────────────────────────────────────────────────────

/**
 * Создаёт запись в истории заявки и обновляет lastActivityAt.
 * Используется для всех типов событий.
 */
export async function createBookingActivity(
  input: CreateActivityInput,
): Promise<BookingActivityRecord> {
  const now = new Date();

  const [record] = await prisma.$transaction([
    prisma.bookingActivity.create({
      data: {
        bookingId: input.bookingId,
        type: input.type,
        actorType: input.actorType ?? "SYSTEM",
        actorId: input.actorId ?? null,
        payload: input.payload ?? Prisma.JsonNull,
        createdAt: now,
      },
      select: {
        id: true,
        bookingId: true,
        type: true,
        actorType: true,
        actorId: true,
        payload: true,
        createdAt: true,
      },
    }),
    // Обновляем lastActivityAt на BookingRequest
    prisma.bookingRequest.update({
      where: { id: input.bookingId },
      data: { lastActivityAt: now },
    }),
  ]);

  return {
    id: record.id,
    bookingId: record.bookingId,
    type: record.type,
    actorType: record.actorType,
    actorId: record.actorId,
    payload: record.payload,
    createdAt: record.createdAt.toISOString(),
  };
}

/**
 * Fire-and-forget обёртка — не бросает исключения.
 * Используется в местах, где ошибка activity не должна ломать основной flow.
 */
export function createBookingActivitySilent(input: CreateActivityInput): void {
  createBookingActivity(input).catch((err) =>
    console.error("[BookingActivity] failed to create activity:", err),
  );
}

// ─── Read ─────────────────────────────────────────────────────────────────────

/**
 * Возвращает историю заявки, отсортированную по времени (новые первые).
 */
export async function getBookingActivities(
  bookingId: string,
  limit = 20,
): Promise<BookingActivityRecord[]> {
  const rows = await prisma.bookingActivity.findMany({
    where: { bookingId },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      bookingId: true,
      type: true,
      actorType: true,
      actorId: true,
      payload: true,
      createdAt: true,
    },
  });

  return rows.map((r) => ({
    id: r.id,
    bookingId: r.bookingId,
    type: r.type,
    actorType: r.actorType,
    actorId: r.actorId,
    payload: r.payload,
    createdAt: r.createdAt.toISOString(),
  }));
}

// ─── Convenience helpers ──────────────────────────────────────────────────────

export function recordBookingCreated(bookingId: string): void {
  createBookingActivitySilent({
    bookingId,
    type: "CREATED",
    actorType: "SYSTEM",
  });
}

export function recordStatusChanged(
  bookingId: string,
  fromStatus: string,
  toStatus: string,
  actorId?: string | null,
): void {
  createBookingActivitySilent({
    bookingId,
    type: "STATUS_CHANGED",
    actorType: actorId ? "BUSINESS" : "SYSTEM",
    actorId: actorId ?? null,
    payload: { from: fromStatus, to: toStatus },
  });
}

export function recordPhoneClicked(
  bookingId: string,
  actorId?: string | null,
): void {
  createBookingActivitySilent({
    bookingId,
    type: "PHONE_CLICKED",
    actorType: "BUSINESS",
    actorId: actorId ?? null,
  });
}
