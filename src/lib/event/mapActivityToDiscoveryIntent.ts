import type { Intent } from "@/lib/intent";
import type { ActivityMock } from "@/types/activity";

/**
 * Раздел discovery (иконка в компактном поиске), к которому относится публикация.
 */
export function mapActivityToDiscoveryIntent(activity: ActivityMock): Intent {
  if (activity.discoveryIntent) return activity.discoveryIntent;
  switch (activity.type) {
    case "BIRTHDAY_BOOKING":
      return "birthday";
    case "CLASS_SCHEDULE":
      return "classes";
    case "ARTICLE":
      return "routes";
    case "PLACE_FLEX":
      if (
        activity.tags.some((t) =>
          ["route", "routes", "маршрут"].includes(t.toLowerCase()),
        )
      ) {
        return "routes";
      }
      return "kuda";
    case "EVENT_FIXED":
    default:
      return "kuda";
  }
}
