import "server-only";
import { loadFamilyPicksProfile } from "./profile";
import { loadHomeContext } from "./homeContext";
import { getKudaDiscoveryFeed } from "@/server/discovery/kudaDiscoveryFeed";
import { zonedDateKey, zonedDayRange } from "@/lib/stories/ranges";
import { DEFAULT_TZ } from "@/server/geo/geoConstants";

const defaults = { profile: loadFamilyPicksProfile, context: loadHomeContext, common: getKudaDiscoveryFeed };

/** Public home searches a rolling 30-day calendar window before limiting visible cards. */
export function publicHomeMonthRange(now: Date = new Date()) {
  return zonedDayRange(zonedDateKey(now, DEFAULT_TZ), 30, DEFAULT_TZ);
}

/** SSR chooses exactly one surface. A profile error propagates; never call common on error. */
export async function loadHomeEvents(userId: string | null, cityId: string, citySlug: string, deps = defaults) {
  const profile = await deps.profile(userId);
  if (profile.audience === "personalized") {
    const { context } = await deps.context(userId, profile);
    return { mode: "personal" as const, context, activities: [], actorId: userId };
  }
  const activitiesInMonth = await deps.common(cityId, citySlug, null, {
    take: 7,
    eventFilters: { dateRange: publicHomeMonthRange(), includeNextOccurrenceWithoutSessions: true, free: false, districtId: null, metroId: null, adultOnly: false },
  });
  // Fallback beyond 30 days only when the current month has no published events.
  const activities = activitiesInMonth.length ? activitiesInMonth
    : await deps.common(cityId, citySlug, null, { take: userId ? 16 : 7, homeGeoFallback: true });
  const periodLabel = activitiesInMonth.length ? "На ближайшие 30 дней" as const : "Ближайшие события" as const;
  const childWithoutBirthDate = userId ? profile.children.find(child => !child.birthDate) : null;
  return { mode: "general" as const, context: null, activities, periodLabel, actorId: userId,
    hasChildren: profile.children.length > 0,
    incompleteChild: childWithoutBirthDate ? { id: childWithoutBirthDate.id, name: childWithoutBirthDate.name } : null,
    incompleteChildren: userId ? profile.children.filter(child => !child.birthDate).map(child => ({ id: child.id, name: child.name })) : [] };
}
