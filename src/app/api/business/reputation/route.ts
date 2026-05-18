/**
 * GET /api/business/reputation
 *
 * Внутренний reputation score бизнеса.
 * НЕ публичный — только для бизнес-кабинета.
 *
 * Response:
 * {
 *   score:          number | null   // 0–100, null если < 5 заявок
 *   tier:           "BRONZE" | "SILVER" | "GOLD" | null
 *   badges:         { type, label, emoji }[]
 *   metrics: {
 *     bookingCount:        number
 *     avgResponseMinutes:  number | null
 *     confirmedRate:       number   // 0–100
 *     completedRate:       number   // 0–100
 *   }
 *   hasEnoughData:  boolean
 *   periodDays:     30
 * }
 */

import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import { getMyBusiness } from "@/server/business/getMyBusiness";
import { getBusinessReputation } from "@/server/services/booking/bookingReputation.service";

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

    const reputation = await getBusinessReputation(business.id);
    return NextResponse.json(reputation);
  } catch (err) {
    console.error("[GET /api/business/reputation]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
