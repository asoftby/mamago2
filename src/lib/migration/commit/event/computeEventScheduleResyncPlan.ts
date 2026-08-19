import {
  eventSessionFingerprintFromStoredSessions,
  eventSessionScheduleFingerprint,
} from "@/lib/business/syncEventActivitySessions";
import { extractScheduleDatesAndStartTime } from "@/lib/event/materializeScheduleSessions";
import type { NormalizedEventScheduleDraft } from "../../adapters/wordpress-db/normalizeEvent";

/**
 * The deterministic decision this narrow resync tool makes — separate from
 * (and never a replacement for) the canonical WordPress-content hash used
 * by `migration-commit-wordpress-db.ts`. That hash proves "has the source
 * *content* changed"; it says nothing about whether the *derived*
 * `ActivitySession` rows still match what today's date would produce from
 * that same, unchanged content (a multi-date schedule prunes past sessions
 * as calendar days pass, even though nothing about the source itself
 * changed). This type is that second, independent proof.
 */
export type EventScheduleResyncAction =
  | "RESYNC"
  | "NOOP_ALREADY_SYNCED"
  | "BLOCKED_EXPIRED_SOURCE"
  | "BLOCKED_LINEAGE_MISSING"
  | "BLOCKED_LINEAGE_AMBIGUOUS";

export interface EventScheduleResyncPlan {
  action: EventScheduleResyncAction;
  desiredSessionCount: number;
  actualSessionCount: number;
  desiredFingerprint: string;
  actualFingerprint: string;
  /** Only set when `scheduleDraft` was `null` — the specific normalizer warning that produced it. */
  blockedReason?: string;
}

/**
 * Pure — no I/O, no Prisma, no clock reads beyond what's already baked into
 * `scheduleDraft` (the caller normalized with `{ now }` before calling
 * this). Given the source-derived desired schedule and the sessions
 * actually materialized today, decides RESYNC vs NOOP vs BLOCKED. Lineage
 * existence/uniqueness is a separate precondition the caller checks before
 * ever reaching this function (see `BLOCKED_LINEAGE_MISSING`/`_AMBIGUOUS`,
 * produced directly by the caller, not by this function — listed here only
 * so `EventScheduleResyncAction` documents the full decision space in one
 * place).
 */
export function computeEventScheduleResyncPlan(input: {
  scheduleDraft: NormalizedEventScheduleDraft | null;
  currentSessions: readonly { startsAt: Date }[];
  blockedReason?: string;
}): EventScheduleResyncPlan {
  const actualFingerprint = eventSessionFingerprintFromStoredSessions([...input.currentSessions]);
  const actualSessionCount = input.currentSessions.length;

  if (!input.scheduleDraft) {
    return {
      action: "BLOCKED_EXPIRED_SOURCE",
      desiredSessionCount: 0,
      actualSessionCount,
      desiredFingerprint: eventSessionScheduleFingerprint({ dates: [] }),
      actualFingerprint,
      blockedReason: input.blockedReason ?? "Source schedule is null after normalization (expired or unparseable).",
    };
  }

  const desiredFingerprint = eventSessionScheduleFingerprint(input.scheduleDraft);
  // The same date-expansion the real writer (`replaceActivitySessionsFromScheduleJson`)
  // uses — `scheduleItems` ranges win over the flat `dates` list when present.
  const desiredSessionCount = extractScheduleDatesAndStartTime(input.scheduleDraft).dates.length;

  return {
    action: desiredFingerprint === actualFingerprint ? "NOOP_ALREADY_SYNCED" : "RESYNC",
    desiredSessionCount,
    actualSessionCount,
    desiredFingerprint,
    actualFingerprint,
  };
}
