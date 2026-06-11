/**
 * POST /api/notifications/mark-booking-read
 *
 * Помечает все непрочитанные BOOKING_CREATED уведомления как просмотренные.
 * Вызывается при открытии страницы /business/bookings.
 * Lightweight — не делает full invalidation.
 */

import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import prisma from "@/lib/prisma";

export async function POST() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const now = new Date();

    await prisma.notification.updateMany({
      where: {
        userId: user.id,
        type: "BOOKING_CREATED",
        seenAt: null,
      },
      data: {
        seenAt: now,
        readAt: now,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[POST /api/notifications/mark-booking-read]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
