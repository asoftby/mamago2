export const PHOENIX_V1_PAST_EVENTS_EXCLUSION_POLICY = {
  policyKey: "PHOENIX_V1_PAST_EVENTS_EXCLUDED",
  targetType: "ACTIVITY",
  reasonCode: "PAST_EVENT_EXCLUDED",
  message: "Phoenix v1 excludes past WordPress events from migration.",
} as const;

export function shouldExcludePastEvent(input: {
  startsAt: Date | string | null | undefined;
  now?: Date;
}): boolean {
  if (!input.startsAt) return false;

  const startsAt =
    input.startsAt instanceof Date ? input.startsAt : new Date(input.startsAt);

  if (Number.isNaN(startsAt.getTime())) return false;

  return startsAt.getTime() < (input.now ?? new Date()).getTime();
}
