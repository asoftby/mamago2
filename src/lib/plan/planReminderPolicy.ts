import { NOTIFICATION_SCENARIOS } from "@/lib/notifications/domainContracts";

/**
 * UI reminder copy is derived from the same product scenarios as notification jobs:
 * - {@link NOTIFICATION_SCENARIOS.PLAN_TOMORROW_DIGEST} — evening / morning digest
 * - {@link NOTIFICATION_SCENARIOS.PLAN_EVENT_2H_BEFORE} — short-fuse same-day reminder
 */
export const PLAN_REMINDER_SCENARIOS = {
  digest: NOTIFICATION_SCENARIOS.PLAN_TOMORROW_DIGEST,
  sameDay: NOTIFICATION_SCENARIOS.PLAN_EVENT_2H_BEFORE,
} as const;

export type PlanReminderPolicy = {
  /** Same-day: show "за 2 часа" while more than N minutes remain (aligns with PLAN_EVENT_2H_BEFORE). */
  sameDayLeadMinutes?: number;
  /** Tomorrow afternoon/evening events: "накануне вечером" while now is before this hour. */
  tomorrowEveningCutoffHour?: number;
  /** Tomorrow morning events (< morningEventCutoffHour): "сегодня вечером" while now is before this hour. */
  lateEveningCutoffHour?: number;
  /** Event hour (local) below which "tomorrow morning" rules apply. */
  morningEventCutoffHour?: number;
};

export const DEFAULT_PLAN_REMINDER_POLICY: Required<PlanReminderPolicy> = {
  sameDayLeadMinutes: 120,
  tomorrowEveningCutoffHour: 18,
  lateEveningCutoffHour: 21,
  morningEventCutoffHour: 11,
};
