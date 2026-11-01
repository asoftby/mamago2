import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import { withdrawStarRating } from "@/server/services/feedback/feedback.service";
import { featureDisabled, feedbackErrorResponse, isStarWriteEnabled } from "@/server/services/feedback/feedbackHttp";

/** DELETE /api/feedback/:id — the author withdraws a star rating (soft; history kept). */
export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  if (!isStarWriteEnabled()) return featureDisabled();
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { id } = await context.params;
    await withdrawStarRating({ userId: user.id, reactionId: id });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return feedbackErrorResponse(error, "withdraw");
  }
}
