import { parseSafeOpaqueId } from "@/lib/decision/identifiers";

/**
 * The recommendation a guest-committed card came from. Made an explicit,
 * typed part of the guest draft (instead of leaving it as untyped fields on
 * `activity`) so the post-auth bridge can forward it to /api/save/plan and
 * the server can verify it against the guest's original RecommendationRun.
 */
export type GuestRecommendationTrace = {
  exposureId: string;
  runId: string | null;
};

/**
 * Reads the exposure/run ids the guest generate endpoint attached to an
 * activity and normalizes them through the bounded identifier contract.
 * Returns null when there is no usable exposure — never a free-text value.
 */
export function extractGuestRecommendationTrace(activity: unknown): GuestRecommendationTrace | null {
  if (!activity || typeof activity !== "object") return null;
  const record = activity as Record<string, unknown>;
  const exposureId = parseSafeOpaqueId(record.recommendationExposureId);
  if (!exposureId) return null;
  return { exposureId, runId: parseSafeOpaqueId(record.recommendationRunId) };
}
