import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { listPublishedReviews } from "@/server/services/feedback/feedback.service";
import { featureDisabled, feedbackErrorResponse, isStarReadEnabled } from "@/server/services/feedback/feedbackHttp";

const querySchema = z.object({
  targetType: z.enum(["PLACE", "EVENT", "OFFER"]),
  targetId: z.string().trim().min(1).max(64),
  cursor: z.string().trim().min(1).max(64).optional(),
});

/** GET /api/feedback/reviews — published review texts, 20 per page. */
export async function GET(request: NextRequest) {
  if (!isStarReadEnabled()) return featureDisabled();
  const parsed = querySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!parsed.success) return NextResponse.json({ error: "invalid_query" }, { status: 400 });
  try {
    return NextResponse.json(await listPublishedReviews(parsed.data));
  } catch (error) {
    return feedbackErrorResponse(error, "reviews");
  }
}
