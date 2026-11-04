import "server-only";
import { loadFamilyPicksProfile } from "./profile";
import { loadHomeContext } from "./homeContext";
import { getKudaDiscoveryFeed } from "@/server/discovery/kudaDiscoveryFeed";
import { zonedDateKey, weekdayFromDateKey, zonedDayRange } from "@/lib/stories/ranges";
import { DEFAULT_TZ } from "@/server/geo/geoConstants";

const defaults = { profile: loadFamilyPicksProfile, context: loadHomeContext, common: getKudaDiscoveryFeed };

/** Remaining days in the current Minsk calendar week, including today and Sunday.
 * This range is passed to the shared discovery query: it must filter BEFORE take,
 * rather than filtering an arbitrary 7-card sample on the client. */
export function publicHomeWeekRange(now: Date = new Date()) {
  const today = zonedDateKey(now, DEFAULT_TZ);
  const weekday = weekdayFromDateKey(today); // Sunday 0, Monday 1.
  return zonedDayRange(today, weekday === 0 ? 1 : 8 - weekday, DEFAULT_TZ);
}

/** SSR chooses exactly one surface. A profile error propagates; never call common on error. */
export async function loadHomeEvents(userId: string | null, cityId: string, citySlug: string, deps = defaults) {
  const profile = await deps.profile(userId);
  if (profile.audience === "personalized") {
    const { context } = await deps.context(userId, profile);
    return { mode: "personal" as const, context, activities: [], actorId: userId };
  }
  const activitiesThisWeek = await deps.common(cityId, citySlug, null, {
    take: 7,
    eventFilters: { dateRange: publicHomeWeekRange(), includeNextOccurrenceWithoutSessions: true, free: false, districtId: null, metroId: null, adultOnly: false },
  });
  // A second query is needed only when the week is empty: keep a useful way
  // into the afisha, and never mislabel next month's events as this week.
  const activities = activitiesThisWeek.length ? activitiesThisWeek
    : await deps.common(cityId, citySlug, null, { take: 7 });
  const periodLabel = activitiesThisWeek.length ? "На этой неделе" as const : "Ближайшие события" as const;
  const childWithoutBirthDate = userId ? profile.children.find(child => !child.birthDate) : null;
  return { mode: "general" as const, context: null, activities, periodLabel, actorId: userId,
    hasChildren: profile.children.length > 0,
    incompleteChild: childWithoutBirthDate ? { id: childWithoutBirthDate.id, name: childWithoutBirthDate.name } : null,
    incompleteChildren: userId ? profile.children.filter(child => !child.birthDate).map(child => ({ id: child.id, name: child.name })) : [] };
}
