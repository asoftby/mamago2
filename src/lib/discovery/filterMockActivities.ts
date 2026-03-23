import type { DiscoveryFilters } from "@/features/filters/discovery/filters.store";
import type { ActivityMock } from "@/mocks/activity.types";
import { AGE_GROUPS } from "@/features/filters/age/ageGroups";

function ageRangeFromGroupId(id: string): { min: number; max: number } | null {
  const g = AGE_GROUPS.find((x) => x.value === id);
  if (!g) return null;
  return { min: g.min, max: g.max ?? 18 };
}

/** Грубая фильтрация моков по возрасту; если бы пусто — возвращаем исходный список */
export function filterMockActivitiesByDiscovery(
  filters: DiscoveryFilters,
  activities: ActivityMock[],
): ActivityMock[] {
  if (!filters.age.length) return activities;

  const ranges = filters.age
    .map(ageRangeFromGroupId)
    .filter((r): r is { min: number; max: number } => r !== null);
  if (!ranges.length) return activities;

  const filtered = activities.filter((a) => {
    const actMin = a.ageFrom ?? 0;
    const actMax = a.ageTo ?? 99;
    return ranges.some(
      (r) => r.min <= actMax && r.max >= actMin,
    );
  });

  return filtered.length > 0 ? filtered : activities;
}
