/**
 * Продуктовые сегменты (ключи совпадают с SegmentResolverService).
 * Расширяйте каталог и резолвер вместе.
 */
export const SEGMENT_KEYS = [
  "NEW_USER",
  "RETURNING_USER",
  "ACTIVE_USER",
  "DORMANT_USER",
  "BROWSER",
  "SAVER",
  "PLANNER",
  "BUYER_INTENT",
  "LAST_MINUTE",
  "ADVANCE_PLANNER",
  "WEEKEND_ORIENTED",
  "WEEKDAY_ORIENTED",
  "ONE_CHILD",
  "MULTI_CHILD",
  "PREFERS_ACTIVE",
  "PREFERS_EDUCATIONAL",
  "PREFERS_CREATIVE",
  "PREFERS_INDOOR",
  "PREFERS_OUTDOOR",
  "PRICE_SENSITIVE",
] as const;

export type SegmentKey = (typeof SEGMENT_KEYS)[number];

export const SEGMENT_CATALOG: Record<
  SegmentKey,
  { title: string; description: string }
> = {
  NEW_USER: {
    title: "New users",
    description:
      "First week in the product — onboarding and first impressions matter most.",
  },
  RETURNING_USER: {
    title: "Returning users",
    description:
      "Came back after the first visit — engagement is forming.",
  },
  ACTIVE_USER: {
    title: "Active (7d)",
    description: "Had activity in the last 7 days — core engaged base.",
  },
  DORMANT_USER: {
    title: "Dormant (30d+)",
    description: "No meaningful activity for over 30 days — win-back candidates.",
  },
  BROWSER: {
    title: "Browsers",
    description: "Many views, few saves — discovery without commitment yet.",
  },
  SAVER: {
    title: "Savers",
    description: "Save often — strong interest signals.",
  },
  PLANNER: {
    title: "Planners",
    description: "Add items to the plan — scheduling intent.",
  },
  BUYER_INTENT: {
    title: "High buyer intent",
    description: "Frequent CTA clicks — closer to conversion.",
  },
  LAST_MINUTE: {
    title: "Last-minute planners",
    description: "Most plans are same-day — spontaneous scheduling.",
  },
  ADVANCE_PLANNER: {
    title: "Advance planners",
    description: "Plans ahead of time — structured families.",
  },
  WEEKEND_ORIENTED: {
    title: "Weekend-oriented",
    description: "Plans cluster on weekends — leisure rhythm.",
  },
  WEEKDAY_ORIENTED: {
    title: "Weekday-oriented",
    description: "More weekday than weekend activity — routine-led.",
  },
  ONE_CHILD: {
    title: "One child",
    description: "Family profile with one child in the app.",
  },
  MULTI_CHILD: {
    title: "Multi-child families",
    description: "Two or more children — heavier planning load.",
  },
  PREFERS_ACTIVE: {
    title: "Prefers active",
    description: "Selected an active tempo in preferences.",
  },
  PREFERS_EDUCATIONAL: {
    title: "Prefers educational",
    description: "Educational vertical dominates browsing.",
  },
  PREFERS_CREATIVE: {
    title: "Prefers creative",
    description: "Creative preference signal in profile.",
  },
  PREFERS_INDOOR: {
    title: "Prefers indoor",
    description: "Leisure format skews toward home / indoor.",
  },
  PREFERS_OUTDOOR: {
    title: "Prefers outdoor",
    description: "Leisure format skews toward outdoor.",
  },
  PRICE_SENSITIVE: {
    title: "Price-sensitive",
    description: "Strong tilt toward offers or deal-seeking behaviour.",
  },
};

export function isSegmentKey(s: string): s is SegmentKey {
  return (SEGMENT_KEYS as readonly string[]).includes(s);
}

export function segmentTitle(key: string): string {
  if (isSegmentKey(key)) return SEGMENT_CATALOG[key].title;
  return key.replace(/_/g, " ");
}

export function segmentDescription(key: string): string {
  if (isSegmentKey(key)) return SEGMENT_CATALOG[key].description;
  return "";
}
