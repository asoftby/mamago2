import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { MAX_EXPERIENCE_FEEDBACK_COMMENT_LENGTH } from "@/lib/experience/feedback";
import { getCurrentUser } from "@/lib/auth/server";
import { getSessionRowIdFromCookies } from "@/lib/analytics/getSessionRowId";
import { prisma } from "@/lib/prisma";
import { syncPlanExperienceReaction } from "@/server/services/feedback/syncPlanFeedback.service";
import { requiresVerifiedPhoneForPlanFeedback } from "@/lib/feedback/planFeedbackPolicy";
import {
  ExperienceDomainError,
  serializeExperience,
  submitExperienceFeedback,
} from "@/server/services/experience/experience.service";

const requestSchema = z.object({
  sentiment: z.enum(["LIKE", "NEUTRAL", "DISLIKE"]),
  comment: z.string().trim().max(MAX_EXPERIENCE_FEEDBACK_COMMENT_LENGTH).nullable().optional(),
}).strict();

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const parsed = requestSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "invalid_sentiment" }, { status: 400 });
    }
    const v1 = process.env.FEEDBACK_V1_WRITE_ENABLED === "1";
    const textRequested = Boolean(parsed.data.comment?.trim());
    if (requiresVerifiedPhoneForPlanFeedback({ feedbackV1Enabled: v1, comment: parsed.data.comment }) && (!user.phoneE164 || !user.phoneVerifiedAt)) {
      return NextResponse.json({ error: "PHONE_NOT_VERIFIED", message: "Подтвердите номер телефона, чтобы оставить комментарий" }, { status: 403 });
    }
    const { id } = await context.params;
    // In v1 each user owns their own reaction. A family member must never
    // overwrite the Experience record created by another family member.
    if (v1) {
      const ownerExperience = await prisma.experience.findUnique({
        where: { id }, select: { userId: true },
      });
      if (!ownerExperience || ownerExperience.userId !== user.id) {
        return NextResponse.json({ error: "not_found" }, { status: 404 });
      }
    }
    const experience = await submitExperienceFeedback({
      userId: user.id,
      experienceId: id,
      sentiment: parsed.data.sentiment,
      comment: parsed.data.comment,
      sessionId: await getSessionRowIdFromCookies(),
      allowEditing: v1,
    });
    if (v1) {
      await syncPlanExperienceReaction({
        userId: user.id,
        experience,
        comment: textRequested ? parsed.data.comment : null,
        phoneVerifiedAt: user.phoneVerifiedAt,
      });
    }
    return NextResponse.json({ experience: serializeExperience(experience) });
  } catch (error) {
    if (error instanceof ExperienceDomainError) {
      return NextResponse.json(
        { error: error.code },
        { status: error.code === "not_found" ? 404 : 409 },
      );
    }
    console.error("[experience] feedback submission failed", error);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
