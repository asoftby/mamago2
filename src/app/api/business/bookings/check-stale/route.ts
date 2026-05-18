/**
 * POST /api/business/bookings/check-stale
 *
 * Lazy stale check — вызывается при открытии страницы заявок.
 * Проверяет stale заявки и отправляет reminder-уведомления с deduplication.
 *
 * Fire-and-forget с точки зрения клиента:
 * клиент не ждёт ответа — просто POST без обработки результата.
 *
 * Response: { checked, notified, skippedDedup }
 */

import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import { getMyBusiness } from "@/server/business/getMyBusiness";
import { checkAndNotifyStaleBookings } from "@/server/services/booking/bookingStale.service";

export async function POST() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const business = await getMyBusiness(user.id);
    if (!business) {
      return NextResponse.json({ error: "Business not found" }, { status: 404 });
    }

    const result = await checkAndNotifyStaleBookings(business.id, user.id);
    return NextResponse.json(result);
  } catch (err) {
    console.error("[POST /api/business/bookings/check-stale]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
