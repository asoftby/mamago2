import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/server";
import { submitStarRating } from "@/server/services/feedback/feedback.service";
import { featureDisabled, feedbackErrorResponse, isStarWriteEnabled } from "@/server/services/feedback/feedbackHttp";

const id = z.string().trim().min(1).max(64);
const requestSchema = z.object({
  targetType: z.enum(["PLACE", "EVENT", "OFFER"]),
  targetId: id,
  value: z.number().int().min(1).max(5),
  tagIds: z.array(id).max(3).optional(),
  occurrence: z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("visit"), date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }).strict(),
    z.object({ kind: z.literal("session"), id }).strict(),
    z.object({ kind: z.literal("offer-session"), id }).strict(),
    z.object({ kind: z.literal("booking"), id }).strict(),
    z.object({ kind: z.literal("plan"), id }).strict(),
  ]),
  experienceLevel: z.enum(["TRIAL", "REGULAR"]).nullable().optional(),
}).strict();

/**
 * POST /api/feedback — create or update the author's 1–5 star rating of one
 * visit (ТЗ Feedback 5★, 7.2–7.3). Auth required; no phone needed for stars.
 */
export async function POST(request: NextRequest) {
  if (!isStarWriteEnabled()) return featureDisabled();
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  try {
    const result = await submitStarRating({ user, ...parsed.data });
    return NextResponse.json(result, { status: result.created ? 201 : 200 });
  } catch (error) {
    return feedbackErrorResponse(error, "rating");
  }
}
