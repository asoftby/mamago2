import { prisma } from "@/lib/prisma";
import type { Experience } from "@prisma/client";
import { experienceSentimentToValue } from "@/lib/feedback/model";

/**
 * Shadow-writes the personal Experience rating into the new Feedback model.
 *
 * Never marks a reaction public, and never infers a historical venue from the
 * current Activity, PlanItem, or Offer location. Attendance here is self-
 * reported; a separate verified booking writer must set venuePlaceIdAtVisit.
 */
export async function syncPlanExperienceReaction(input: {
  userId: string;
  experience: Experience;
  comment?: string | null;
  phoneVerifiedAt?: Date | null;
}): Promise<string> {
  const { userId, experience } = input;
  if (experience.userId !== userId || experience.attendance !== "ATTENDED" || !experience.feedbackSentiment) {
    throw new Error("Experience feedback must belong to the attending user");
  }
  const plan = await prisma.planItem.findUnique({
    where: { id: experience.sourcePlanItemId },
    select: { id: true, activityId: true, familyId: true },
  });
  if (!plan || plan.activityId !== experience.entityId || experience.entityType !== "EVENT") {
    throw new Error("Experience plan/event identity mismatch");
  }

  const actorKey = `user:${userId}`;
  const reaction = await prisma.feedbackReaction.upsert({
    where: {
      actorKey_targetType_targetId_occurrenceKey: {
        actorKey,
        targetType: "EVENT",
        targetId: experience.entityId,
        occurrenceKey: plan.id,
      },
    },
    create: {
      actorKey,
      userId,
      familyId: plan.familyId,
      targetType: "EVENT",
      targetId: experience.entityId,
      occurrenceKey: plan.id,
      value: experienceSentimentToValue(experience.feedbackSentiment),
      visitStatus: "SELF_REPORTED",
      source: "PLAN",
      isPublicEligible: false,
      // A plan's venue may have changed after the visit. Leave snapshot null.
      venuePlaceIdAtVisit: null,
    },
    update: {
      value: experienceSentimentToValue(experience.feedbackSentiment),
    },
    select: { id: true },
  });

  const comment = input.comment?.trim();
  if (comment && input.phoneVerifiedAt) {
    await prisma.feedbackReview.upsert({
      where: { reactionId: reaction.id },
      create: {
        reactionId: reaction.id,
        text: comment,
        status: "PENDING",
        phoneVerifiedAt: input.phoneVerifiedAt,
      },
      update: {
        text: comment,
        status: "PENDING",
        moderatedById: null,
        moderatedAt: null,
        phoneVerifiedAt: input.phoneVerifiedAt,
      },
    });
  }

  return reaction.id;
}
