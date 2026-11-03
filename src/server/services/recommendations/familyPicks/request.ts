import { parseSafeOpaqueId } from "@/lib/decision/identifiers";
import { familyPicksProfileContext, type FamilyPicksProfile } from "./profile";
import type { LoadFamilyPicksInput, FamilyPicksResponse } from "./load";

type Dependencies = {
  getCurrentUser: () => Promise<{ id: string } | null>;
  getSessionId: () => Promise<string | null>;
  loadProfile: (userId: string | null) => Promise<FamilyPicksProfile>;
  loadPicks: (input: LoadFamilyPicksInput) => Promise<FamilyPicksResponse>;
};

/** Shared request orchestration; contextOnly never invokes a recommendation loader/trace.
 * Selection is prepared, not enabled: legacy requests with a selected child fail closed
 * instead of silently returning unfiltered cards under a selected child's label.
 */
export async function resolveFamilyPicksRequest(params: URLSearchParams, deps: Dependencies) {
  const citySlug = (params.get("city") ?? "minsk").toLowerCase();
  if (!/^[a-z0-9-]{1,64}$/.test(citySlug)) return { status: 400, body: { error: "invalid_city" } };
  const rawAnonymousId = params.get("anonymousId");
  const anonymousId = rawAnonymousId ? parseSafeOpaqueId(rawAnonymousId) : null;
  if (rawAnonymousId && !anonymousId) return { status: 400, body: { error: "invalid_anonymous_id" } };

  const selections = params.getAll("selectedChildId");
  const selectedChildId = selections.length === 1 ? parseSafeOpaqueId(selections[0]) : null;
  if (selections.length > 1 || (selections.length === 1 && !selectedChildId)) {
    return { status: 400, body: { error: "invalid_selected_child_id" } };
  }
  const contextOnly = params.get("contextOnly");
  if (params.getAll("contextOnly").length > 1 || (contextOnly !== null && contextOnly !== "1")) {
    return { status: 400, body: { error: "invalid_context_only" } };
  }

  const user = await deps.getCurrentUser();
  if (contextOnly === "1" || selectedChildId) {
    const profile = await deps.loadProfile(user?.id ?? null);
    // Same generic response for absent, foreign, deleted and former-family children.
    if (selectedChildId && !profile.children.some((child) => child.id === selectedChildId)) {
      return { status: 404, body: { error: "selection_unavailable" } };
    }
    if (contextOnly !== "1") return { status: 409, body: { error: "selection_not_enabled" } };
    return { status: 200, body: { profileContext: familyPicksProfileContext(profile, selectedChildId) } };
  }

  return {
    status: 200,
    body: await deps.loadPicks({
      citySlug,
      userId: user?.id ?? null,
      sessionId: await deps.getSessionId(),
      anonymousId,
    }),
  };
}
