/**
 * GET /api/business/bookings/feedback-summary
 *
 * Aggregate feedback metrics для бизнес-кабинета.
 * Только aggregate — raw feedback и комментарии не передаются.
 *
 * Response:
 * {
 *   feedbackCount:  number
 *   averageRating:  number | null   // 1.0–5.0, 1 decimal
 *   positiveRate:   number          // % of 4–5 star (0–100)
 *   negativeRate:   number          // % of 1–2 star (0–100)
 * }
 */

import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import { getMyBusiness } from "@/server/business/getMyBusiness";
import { getBusinessFeedbackSummary } from "@/server/services/booking/bookingFeedback.service";

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

    const summary = await getBusinessFeedbackSummary(business.id);
    return NextResponse.json(summary);
  } catch (err) {
    console.error("[GET /api/business/bookings/feedback-summary]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
