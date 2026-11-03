import "server-only";
import { loadHomeContext } from "./homeContext";
import { loadPersonalFamilyPicks } from "./load";
import { recordRecommendationRun } from "../RecommendationTraceService";
import { withImageDimensions } from "@/server/media/loadImageDimensionsByUrl";
import type { FamilyPicksProfile } from "./profile";
import type { HomeFamilyContext } from "@/features/city-home/lib/familyHome";
import type { PersonalFamilySelection } from "./select";

export async function deliverHomeFamilyPicks(input: {
  userId: string; citySlug: string; profile: FamilyPicksProfile; context: HomeFamilyContext;
  selection: PersonalFamilySelection; dismissedIds: string[]; sessionId: string | null; signal?: AbortSignal;
}) {
  const result = await loadPersonalFamilyPicks({ userId: input.userId, citySlug: input.citySlug,
    selection: input.selection, serverProfile: input.profile, excludeActivityIds: input.dismissedIds });
  const hydrated = await withImageDimensions(result.items, item => item.imageUrl);
  const fresh = await loadHomeContext(input.userId);
  if (fresh.context.signature !== input.context.signature) throw new Error("profile_changed");
  if (input.signal?.aborted) throw new Error("delivery_aborted");
  const trace = hydrated.length ? await recordRecommendationRun({
    userId: input.userId, sessionId: input.sessionId, surface: "HOME", citySlug: input.citySlug,
    targetDateFrom: result.window.dateFrom, targetDateTo: result.window.dateTo,
    algorithmVersion: result.policyVersion, candidateCount: result.candidateCount,
    decisionContext: {
      intent: "family_picks", actor: { kind: "user", id: input.userId },
      subjects: input.profile.children.filter(child => input.selection.mode === "ALL_FAMILY" || child.id === input.selection.selectedChildId)
        .map(child => ({ kind: "child", refId: child.id, source: "profile" })),
      constraints: { policy: { value: result.policyVersion, source: "derived" }, selection: { value: input.selection, source: "manual" },
        sharedAlgorithm: { value: result.sharedAlgorithmVersion, source: "derived" } },
    },
    items: hydrated.map(item => ({ entityType: "EVENT", entityId: item.id, position: item.position, score: item.score,
      reasonCodes: [item.allChildrenMatch ? "AGE_MATCH_ALL" : "AGE_MATCH"], scoreBreakdown: { sharedScore: item.score } })),
  }) : null;
  return { ...result, context: input.context, runId: trace?.runId ?? null,
    items: hydrated.map(item => ({ ...item, exposureId: trace?.exposureIdByEntityKey.get(`EVENT:${item.id}`) ?? null })) };
}
export type HomeFamilyDelivery = Awaited<ReturnType<typeof deliverHomeFamilyPicks>>;
