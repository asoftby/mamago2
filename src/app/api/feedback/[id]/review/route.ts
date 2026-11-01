import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/server";
import { MAX_FEEDBACK_REVIEW_LENGTH } from "@/lib/feedback/model";
import { submitReviewText } from "@/server/services/feedback/feedback.service";
import { featureDisabled, feedbackErrorResponse, isStarWriteEnabled } from "@/server/services/feedback/feedbackHttp";

const requestSchema = z.object({ text: z.string().trim().min(1).max(MAX_FEEDBACK_REVIEW_LENGTH) }).strict();

/** PUT /api/feedback/:id/review — review text; verified phone required; goes to moderation. */
export async function PUT(request: NextRequest, context: { params: Promise<{ id: string }> }) {
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
  if (!parsed.success) return NextResponse.json({ error: "INVALID_REVIEW_TEXT" }, { status: 400 });
  try {
    const { id } = await context.params;
    return NextResponse.json(await submitReviewText({ user, reactionId: id, text: parsed.data.text }));
  } catch (error) {
    return feedbackErrorResponse(error, "review");
  }
}
