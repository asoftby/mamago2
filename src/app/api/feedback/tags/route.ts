import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { listAvailableTags } from "@/server/services/feedback/feedback.service";
import { featureDisabled, feedbackErrorResponse, isStarReadEnabled } from "@/server/services/feedback/feedbackHttp";

const querySchema = z.object({
  targetType: z.enum(["PLACE", "EVENT", "OFFER"]),
  value: z.coerce.number().int().min(1).max(5),
  partyCategory: z.string().trim().min(1).max(32).optional(),
});

/** GET /api/feedback/tags — chips offered for a target type and star value. */
export async function GET(request: NextRequest) {
  if (!isStarReadEnabled()) return featureDisabled();
  const parsed = querySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!parsed.success) return NextResponse.json({ error: "invalid_query" }, { status: 400 });
  try {
    return NextResponse.json({ tags: await listAvailableTags(parsed.data) });
  } catch (error) {
    return feedbackErrorResponse(error, "tags");
  }
}
