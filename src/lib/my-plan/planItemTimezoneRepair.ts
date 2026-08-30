export type PlanItemTimezoneRepairResult =
  | { kind: "already-correct"; sessionId: string; startsAt: Date }
  | { kind: "legacy-utc-wall-clock"; sessionId: string; startsAt: Date }
  | { kind: "unresolved"; reason: string };

type SessionCandidate = {
  id: string;
  startsAt: Date;
};

function wallClockEncodedAsUtc(instant: Date, timeZone: string): Date {
  const parts = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
    timeZone,
  }).formatToParts(instant);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));

  return new Date(
    Date.UTC(
      Number(values.year),
      Number(values.month) - 1,
      Number(values.day),
      Number(values.hour),
      Number(values.minute),
      Number(values.second),
    ),
  );
}

/**
 * Resolves only the historical "local wall clock persisted as UTC digits" bug.
 *
 * PlanItem.startsAt has a canonical contract: it is an absolute UTC instant.
 * Therefore an exact ActivitySession instant always wins and is never shifted.
 * A legacy repair is allowed only when there is no exact session match and
 * exactly one session whose local wall-clock representation equals the stored
 * PlanItem value.
 */
export function resolvePlanItemTimezoneRepair(
  storedStartsAt: Date,
  sessions: readonly SessionCandidate[],
  timeZone = "Europe/Minsk",
): PlanItemTimezoneRepairResult {
  const exact = sessions.filter(
    (session) => session.startsAt.getTime() === storedStartsAt.getTime(),
  );
  if (exact.length === 1) {
    return {
      kind: "already-correct",
      sessionId: exact[0]!.id,
      startsAt: exact[0]!.startsAt,
    };
  }
  if (exact.length > 1) {
    return { kind: "unresolved", reason: "multiple exact session matches" };
  }

  const legacy = sessions.filter(
    (session) =>
      wallClockEncodedAsUtc(session.startsAt, timeZone).getTime() ===
      storedStartsAt.getTime(),
  );
  if (legacy.length !== 1) {
    return {
      kind: "unresolved",
      reason:
        legacy.length === 0
          ? "no deterministic session match"
          : "multiple legacy wall-clock matches",
    };
  }

  return {
    kind: "legacy-utc-wall-clock",
    sessionId: legacy[0]!.id,
    startsAt: legacy[0]!.startsAt,
  };
}
