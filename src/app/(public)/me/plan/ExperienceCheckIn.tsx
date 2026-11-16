"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { todayKey } from "@/lib/date/dateKey";
import { PlanFeedbackCard } from "@/features/my-plan/components/v3/PlanFeedbackCard";
import { MY_PLAN_V3_TOKENS } from "@/features/my-plan/components/v3/myPlanV3Tokens";
import {
  hasPendingPlanFeedback,
  type PlanExperienceFeed,
  type PlanExperienceRow,
} from "@/features/my-plan/components/v3/planExperienceApi";

/** SSR shape from `/me/plan` — same fields the overlay feed uses for pending asks. */
export type ExperienceCheckInCandidate = {
  planItemId: string;
  activityId: string;
  title: string;
  plannedDate: string;
  plannedStartsAt: string | null;
};

export type ExperienceCheckInState = {
  id: string;
  planItemId: string;
  title: string;
  plannedDate: string;
  attendance: "ATTENDED" | "NOT_ATTENDED";
  feedbackSentiment: "LIKE" | "NEUTRAL" | "DISLIKE" | null;
  feedbackComment?: string | null;
  canCorrectAttendance?: boolean;
};

function toFeedRow(item: ExperienceCheckInState): PlanExperienceRow {
  return {
    id: item.id,
    planItemId: item.planItemId,
    title: item.title,
    plannedDate: item.plannedDate,
    attendance: item.attendance,
    feedbackSentiment: item.feedbackSentiment,
    feedbackComment: item.feedbackComment ?? null,
    canCorrectAttendance: item.canCorrectAttendance,
  };
}

/**
 * Desktop `/me/plan` check-in: same card as the mobile «Мой план» overlay
 * (`PlanFeedbackCard`), fed by SSR candidates instead of a client refetch.
 */
export function ExperienceCheckIn({
  candidates,
  recentExperiences,
  feedbackV1Enabled = false,
  onOpenVisits,
}: {
  candidates: ExperienceCheckInCandidate[];
  recentExperiences: ExperienceCheckInState[];
  /** Mirrors `/api/plan/experiences` so editable Feedback v1 mode works on SSR. */
  feedbackV1Enabled?: boolean;
  onOpenVisits?: () => void;
}) {
  const router = useRouter();
  const feed = useMemo((): PlanExperienceFeed => {
    // Feedback v1 is personal: do not ask another adult to rate someone else's visit.
    const awaitingSource = feedbackV1Enabled
      ? recentExperiences.filter((item) => item.canCorrectAttendance !== false)
      : recentExperiences;
    const awaitingFeedback = awaitingSource
      .filter((item) => item.attendance === "ATTENDED" && !item.feedbackSentiment)
      .map(toFeedRow);
    const pending = candidates.filter(
      (item) => !recentExperiences.some((recent) => recent.planItemId === item.planItemId),
    );
    return {
      pending,
      awaitingFeedback,
      visits: recentExperiences.map(toFeedRow),
      // Phone gate is enforced by the feedback API (403 → modal); SSR does not ship this flag.
      phoneVerified: true,
      feedbackV1Enabled,
    };
  }, [candidates, recentExperiences, feedbackV1Enabled]);

  // Keep the Account header wrapper `:empty` when there is nothing to ask,
  // so it does not reserve margin under the subtitle.
  if (!hasPendingPlanFeedback(feed)) return null;

  return (
    <div style={MY_PLAN_V3_TOKENS} className="min-w-0">
      <PlanFeedbackCard
        feed={feed}
        todayIso={todayKey()}
        onChanged={() => router.refresh()}
        onOpenVisits={onOpenVisits ?? (() => {})}
      />
    </div>
  );
}
