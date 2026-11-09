"use client";

import { toast } from "@/lib/toast";
import { applyGuestDayScenarioAfterAuth, type GuestDraftOutcome } from "./guestDayScenarioDraft";
import { requestPlanRefetchForDate } from "./myPlanOpenIntent";
import { persistSelectedPlanDate } from "@/features/my-plan/lib/planRecommendationDraftStorage";
import { invalidatePlanDayMarkers } from "@/features/plan-calendar/usePlanDayCounts";

/**
 * Saves the day a guest built before signing in AND tells the app about it: the selected date, the ✦ markers, a refetch
 * of the days, a toast (or the reason the server refused). The ONE place this happens: the post-auth pipeline (modal
 * auth) and the My Plan recovery effect (the full-page /login, which never runs the pipeline) both call it. The save
 * itself is idempotent (stored key) and deduplicated while in flight, so running from both is safe.
 */
export async function applyGuestDayScenarioAndAnnounce(): Promise<GuestDraftOutcome> {
  const outcome = await applyGuestDayScenarioAfterAuth();
  if (outcome.kind === "saved") {
    persistSelectedPlanDate(outcome.dates[0]!);
    invalidatePlanDayMarkers();
    for (const date of outcome.dates) requestPlanRefetchForDate(date);
    toast.success(outcome.dates.length > 1 ? "Выходные сохранены в план" : "День сохранён в план");
  } else if (outcome.kind === "rejected") {
    toast.error("Не удалось сохранить день", { description: outcome.message });
  }
  return outcome;
}
