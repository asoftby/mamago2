import "server-only";
import { loadFamilyPicksProfile } from "./profile";
import { loadHomeContext } from "./homeContext";
import { getKudaDiscoveryFeed } from "@/server/discovery/kudaDiscoveryFeed";
import { homeFamilyPicksEnabled } from "@/features/city-home/lib/familyHome";

const defaults = { profile: loadFamilyPicksProfile, context: loadHomeContext, common: getKudaDiscoveryFeed };
/** SSR chooses exactly one surface. A profile error propagates; never call common on error. */
export async function loadHomeEvents(userId: string | null, cityId: string, citySlug: string, deps = defaults, enabled = homeFamilyPicksEnabled()) {
  const profile = await deps.profile(userId);
  if (enabled && profile.audience === "personalized") {
    const { context } = await deps.context(userId, profile);
    return { mode: "personal" as const, context, activities: [], actorId: userId };
  }
  const activities = await deps.common(cityId, citySlug, null, { take: 7 });
  return { mode: "general" as const, context: null, activities, actorId: userId };
}
