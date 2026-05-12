/**
 * GET /api/business/bookings/analytics
 *
 * Lightweight booking analytics для бизнес-кабинета.
 * Период: последние 30 дней (rolling window).
 *
 * Response:
 * {
 *   todayNew:            number   // новых заявок сегодня
 *   avgResponseMinutes:  number | null  // среднее время ответа в минутах
 *   confirmedRate:       number   // % подтверждённых (0–100)
 *   completedRate:       number   // % завершённых (0–100)
 *   trustSignals:        { type, label }[]
 *   periodDays:          30
 * }
 */

import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import { getMyBusiness } from "@/server/business/getMyBusiness";
import { getBookingAnalytics } from "@/server/services/booking/bookingAnalytics.service";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const business = await getMyBusiness(user.id);
    if (!business) {
      return NextResponse.json({ error: "Business not found" }, { status: 404 });
    }

    const analytics = await getBookingAnalytics(business.id);
    return NextResponse.json(analytics);
  } catch (err) {
    console.error("[GET /api/business/bookings/analytics]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
