import type { PlanSentiment } from "./PlanFace";

export type PlanExperiencePending = {
  planItemId: string;
  activityId: string;
  title: string;
  plannedDate: string;
  plannedStartsAt: string | null;
};

export type PlanExperienceRow = {
  id: string;
  planItemId: string;
  title: string;
  plannedDate: string;
  attendance: "ATTENDED" | "NOT_ATTENDED";
  feedbackSentiment: PlanSentiment | null;
  feedbackComment: string | null;
};

export type PlanExperienceFeed = {
  pending: PlanExperiencePending[];
  awaitingFeedback: PlanExperienceRow[];
  visits: PlanExperienceRow[];
  phoneVerified: boolean;
};

export async function fetchPlanExperienceFeed(): Promise<PlanExperienceFeed | null> {
  try {
    const res = await fetch("/api/plan/experiences", { credentials: "include", cache: "no-store" });
    if (!res.ok) return null;
    return (await res.json()) as PlanExperienceFeed;
  } catch {
    return null;
  }
}

export type FeedbackResult = "ok" | "phone" | "error";

export async function postExperienceAttendance(
  planItemId: string,
  attendance: "ATTENDED" | "NOT_ATTENDED",
): Promise<PlanExperienceRow | null> {
  try {
    const res = await fetch("/api/plan/experiences", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ planItemId, attendance }),
    });
    if (!res.ok) return null;
    const payload = (await res.json()) as { experience: PlanExperienceRow };
    return payload.experience;
  } catch {
    return null;
  }
}

export async function postExperienceFeedback(
  experienceId: string,
  sentiment: PlanSentiment,
  comment: string,
): Promise<FeedbackResult> {
  try {
    const res = await fetch(`/api/plan/experiences/${experienceId}/feedback`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sentiment, comment: comment.trim() || null }),
    });
    if (res.status === 403) {
      const body = (await res.json().catch(() => null)) as { error?: string } | null;
      if (body?.error === "PHONE_NOT_VERIFIED") return "phone";
    }
    return res.ok ? "ok" : "error";
  } catch {
    return "error";
  }
}
