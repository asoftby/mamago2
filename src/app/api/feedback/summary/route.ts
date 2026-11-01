import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getFeedbackSummary } from "@/server/services/feedback/feedback.service";
import { featureDisabled, feedbackErrorResponse, isStarReadEnabled } from "@/server/services/feedback/feedbackHttp";

const querySchema = z.object({
  targetType: z.enum(["PLACE", "EVENT", "OFFER", "BUSINESS"]),
  targetId: z.string().trim().min(1).max(64),
});

/** GET /api/feedback/summary — public star summary from precomputed aggregates. */
export async function GET(request: NextRequest) {
  if (!isStarReadEnabled()) return featureDisabled();
  const parsed = querySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!parsed.success) return NextResponse.json({ error: "invalid_query" }, { status: 400 });
  try {
    return NextResponse.json(await getFeedbackSummary(parsed.data));
  } catch (error) {
    return feedbackErrorResponse(error, "summary");
  }
}
