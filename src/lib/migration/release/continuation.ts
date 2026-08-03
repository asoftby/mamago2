import { readFileSync } from "node:fs";
import type { PrismaClient } from "@prisma/client";

import { exactExecutableKeys, sha256Bytes } from "./manifest";
import type {
  PhoenixEnvironmentContext,
  PhoenixExpectedRecord,
  PhoenixPhaseName,
  PhoenixPhaseReport,
  PhoenixReleasePhase,
} from "./types";

function blocked(code: string): Error {
  return new Error(`RELEASE_BLOCKED:${code}`);
}

/**
 * Maps an executable Phoenix phase to the `MigrationLineage.targetType`
 * its writer records identity under. Phases not listed here (currently
 * only `events`, which uses a differently-shaped adapter) are not
 * supported by continuation — see `resolveExactCompletedPrefix`.
 */
export const CONTINUATION_PHASE_TARGET_TYPE: Partial<Record<PhoenixPhaseName, string>> = {
  users: "USER",
  businesses: "BUSINESS",
  places: "PLACE",
  offers: "OFFER",
  routes: "ROUTE",
  articles: "ARTICLE",
};

// ---------------------------------------------------------------------------
// Cross-code-SHA continuation identity — loading and authorizing a
// predecessor failure report produced by an *older* code SHA than the one
// currently running.
// ---------------------------------------------------------------------------

const CODE_SHA_PATTERN = /^[0-9a-f]{40}$/;

/**
 * Explicit allowlist of predecessor code SHAs a cross-image continuation is
 * permitted to resume from. Deliberately not an open `--ignore-code-sha`
 * escape hatch and not "any SHA the operator names": extending this list to
 * a new predecessor requires a reviewed source change, never an
 * operator-supplied flag at run time.
 */
export const KNOWN_PREDECESSOR_CODE_SHAS: ReadonlySet<string> = new Set([
  // Original Phoenix DEV apply attempt (2026-08-03) that stopped cleanly at
  // wordpress-db:user:38 — see docs/migration/prelaunch-checklist.md §G.
  "f466c34c0cf095d054ae79d86a12505129719739",
]);

export interface CrossShaContinuationRequest {
  reportPath: string;
  reportSha256: string;
  predecessorCodeSha: string;
}

export interface CrossShaContinuationExpected {
  releaseId: string;
  manifestHash: string;
  currentCodeSha: string;
  environment: PhoenixEnvironmentContext;
}

function parseSoleReportEntry(raw: string): PhoenixPhaseReport {
  const lines = raw.split("\n").filter((line) => line.trim().length > 0);
  if (lines.length === 0) throw blocked("CONTINUATION_REPORT_EMPTY");
  // A cross-SHA continuation authorizes one specific, previously-captured
  // failure artifact — not an ongoing multi-phase journal — so exactly one
  // line is required, not "the last of however many".
  if (lines.length !== 1) throw blocked("CONTINUATION_REPORT_NOT_SINGLE_ENTRY");

  let entry: PhoenixPhaseReport;
  try {
    entry = JSON.parse(lines[0]) as PhoenixPhaseReport;
  } catch {
    throw blocked("CONTINUATION_REPORT_MALFORMED");
  }
  if (
    !entry ||
    typeof entry.releaseId !== "string" ||
    typeof entry.codeSha !== "string" ||
    typeof entry.manifestHash !== "string" ||
    typeof entry.phase !== "string" ||
    typeof entry.created !== "number" ||
    typeof entry.updated !== "number" ||
    typeof entry.failed !== "number" ||
    (typeof entry.firstFailure !== "string" && entry.firstFailure !== null) ||
    typeof entry.environmentFingerprint !== "object" ||
    entry.environmentFingerprint === null
  ) {
    throw blocked("CONTINUATION_REPORT_MALFORMED");
  }
  return entry;
}

/**
 * `sourceRecordKey` is always the fixed 3-segment `wordpress-db:<entity>:<id>`
 * shape in this codebase, but `firstFailure` appends `:${error}` — and the
 * error suffix can itself contain `:` (e.g. `UNEXPECTED_PLAN_ACTION:CREATE`)
 * — so only the first 3 segments are ever safe to treat as the key.
 */
export function extractFailedKey(report: PhoenixPhaseReport): string {
  if (report.failed <= 0 || !report.firstFailure) throw blocked("CONTINUATION_REPORT_NOT_A_FAILURE");
  const key = report.firstFailure.split(":").slice(0, 3).join(":");
  if (!key) throw blocked("CONTINUATION_REPORT_NOT_A_FAILURE");
  return key;
}

/**
 * Loads and fully authorizes a predecessor progress report for continuation
 * under a *different* (newer) code SHA. Every check fails closed; nothing
 * here mutates state. This is the only way this module accepts a report
 * whose `codeSha` differs from the code currently running — see
 * `KNOWN_PREDECESSOR_CODE_SHAS`, which this never bypasses.
 */
export function loadCrossShaContinuationReport(
  request: CrossShaContinuationRequest,
  expected: CrossShaContinuationExpected,
): PhoenixPhaseReport {
  if (!CODE_SHA_PATTERN.test(request.predecessorCodeSha)) throw blocked("CONTINUATION_PREDECESSOR_CODE_SHA_INVALID");
  if (!KNOWN_PREDECESSOR_CODE_SHAS.has(request.predecessorCodeSha)) throw blocked("CONTINUATION_PREDECESSOR_CODE_SHA_UNKNOWN");
  if (!CODE_SHA_PATTERN.test(expected.currentCodeSha)) throw blocked("CONTINUATION_CURRENT_CODE_SHA_INVALID");
  if (expected.currentCodeSha === request.predecessorCodeSha) throw blocked("CONTINUATION_CODE_SHA_UNCHANGED");

  let raw: string;
  try {
    raw = readFileSync(request.reportPath, "utf8");
  } catch {
    throw blocked("CONTINUATION_REPORT_UNREADABLE");
  }
  const actualSha256 = sha256Bytes(raw);
  if (actualSha256 !== request.reportSha256.trim().toLowerCase()) throw blocked("CONTINUATION_REPORT_SHA256_MISMATCH");

  const report = parseSoleReportEntry(raw);
  if (report.codeSha !== request.predecessorCodeSha) throw blocked("CONTINUATION_REPORT_CODE_SHA_MISMATCH");
  if (report.releaseId !== expected.releaseId) throw blocked("CONTINUATION_RELEASE_ID_MISMATCH");
  if (report.manifestHash !== expected.manifestHash) throw blocked("CONTINUATION_MANIFEST_HASH_MISMATCH");
  if (report.environment !== expected.environment.environment) throw blocked("CONTINUATION_ENVIRONMENT_MISMATCH");
  if (JSON.stringify(report.environmentFingerprint) !== JSON.stringify(expected.environment)) {
    throw blocked("CONTINUATION_ENVIRONMENT_FINGERPRINT_MISMATCH");
  }
  // Validates the key is well-formed and present; the failure itself is
  // re-validated (`report.failed <= 0`) inside extractFailedKey.
  extractFailedKey(report);

  return report;
}

// ---------------------------------------------------------------------------
// Exact completed-prefix proof — the sole mechanism that decides which
// records `SequentialEntityPhaseAdapter` is allowed to skip.
// ---------------------------------------------------------------------------

export interface ExactPrefixContinuation {
  phase: PhoenixPhaseName;
  alreadyCompleted: ReadonlySet<string>;
  continuationStartKey: string;
}

/**
 * Proves — never assumes — the exact live-DB completed prefix of the failed
 * phase's deterministic execution order (`exactExecutableKeys`, i.e. the
 * manifest's own declared record order). This does not trust the
 * predecessor report's own aggregate `created + updated` count as the
 * source of truth (only as an upper-bound sanity signal, since a
 * predecessor report captured under an older code SHA may predate a release
 * action exception that changes what "already complete" means for a given
 * key) — the live `MigrationLineage` rows, checked position-by-position
 * against the manifest's own order, are authoritative.
 *
 * Every check fails closed:
 *  - a record inside the expected prefix whose manifest action is not
 *    CREATE/UPDATE cannot be proven complete purely from lineage existence
 *    (a SKIPPED outcome leaves no row) — this module never guesses, so it
 *    rejects rather than assumes such a phase is safe to continue;
 *  - any live lineage row for a key outside this phase's record set at all
 *    is unrelated/unexpected contamination;
 *  - any duplicate live lineage row for the same key is itself corruption;
 *  - a missing key inside the expected prefix, or a completed key at or
 *    after the terminal failed key's position, both fail closed.
 */
export async function resolveExactCompletedPrefix(
  prisma: PrismaClient,
  sourceNamespace: string,
  report: PhoenixPhaseReport,
  phase: PhoenixReleasePhase,
): Promise<ExactPrefixContinuation> {
  if (phase.name !== report.phase) throw blocked("CONTINUATION_PHASE_MISMATCH");
  const targetType = CONTINUATION_PHASE_TARGET_TYPE[report.phase];
  if (!targetType) throw blocked(`CONTINUATION_UNSUPPORTED_PHASE:${report.phase}`);

  const failedKey = extractFailedKey(report);
  const orderedKeys = exactExecutableKeys(phase);
  const failedIndex = orderedKeys.indexOf(failedKey);
  if (failedIndex < 0) throw blocked("CONTINUATION_FAILED_KEY_NOT_IN_MANIFEST");

  const expectedPrefix = orderedKeys.slice(0, failedIndex);

  const recordAction = new Map(phase.records.map((record) => [record.sourceRecordKey, record.action]));
  const ambiguousKey = expectedPrefix.find((key) => {
    const action = recordAction.get(key);
    return action !== "CREATE" && action !== "UPDATE";
  });
  if (ambiguousKey) throw blocked(`CONTINUATION_PREFIX_AMBIGUOUS_ACTION:${ambiguousKey}`);

  const rows = await prisma.migrationLineage.findMany({
    where: { targetType: targetType as never, isActive: true, source: { sourceNamespace } },
    select: { sourceRecordKey: true },
  });

  const seen = new Set<string>();
  for (const row of rows) {
    if (seen.has(row.sourceRecordKey)) throw blocked(`CONTINUATION_DUPLICATE_LINEAGE:${row.sourceRecordKey}`);
    seen.add(row.sourceRecordKey);
  }

  const allPhaseKeys = new Set(phase.records.map((record) => record.sourceRecordKey));
  const unrelatedKey = [...seen].find((key) => !allPhaseKeys.has(key));
  if (unrelatedKey) throw blocked(`CONTINUATION_UNRELATED_LINEAGE:${unrelatedKey}`);

  const missingKey = expectedPrefix.find((key) => !seen.has(key));
  if (missingKey) throw blocked(`CONTINUATION_PREFIX_KEY_MISSING:${missingKey}`);

  const expectedPrefixSet = new Set(expectedPrefix);
  const extraKey = [...seen].find((key) => !expectedPrefixSet.has(key));
  if (extraKey) {
    throw blocked(
      extraKey === failedKey ? "CONTINUATION_FAILED_KEY_ALREADY_COMPLETE" : `CONTINUATION_UNEXPECTED_COMPLETED_KEY:${extraKey}`,
    );
  }

  // Advisory upper-bound only: the exact positional proof above is what
  // actually gates the skip set. The report's own count is allowed to be
  // lower than the proven prefix (e.g. a chained continuation attempt whose
  // own report only claims the records it personally created), but never
  // higher than what the manifest's own order says exists before the
  // failure.
  if (report.created + report.updated > expectedPrefix.length) {
    throw blocked(
      `CONTINUATION_REPORT_COUNT_EXCEEDS_PREFIX:reported=${report.created + report.updated}:prefix=${expectedPrefix.length}`,
    );
  }

  return { phase: phase.name, alreadyCompleted: expectedPrefixSet, continuationStartKey: failedKey };
}

// ---------------------------------------------------------------------------
// Narrow, explicit release action exceptions — corrections to a single
// record's manifest-declared action, never a general "trust the live plan"
// mechanism.
// ---------------------------------------------------------------------------

export interface ReleaseActionException {
  phase: PhoenixPhaseName;
  sourceRecordKey: string;
  manifestDeclaredAction: PhoenixExpectedRecord["action"];
  correctedAction: PhoenixExpectedRecord["action"];
  reason: string;
}

/**
 * Exactly one entry today: `wordpress-db:user:38`. The committed manifest
 * (`docs/migration/releases/phoenix-approved-2026-07-30.json`) declares it
 * `SKIP_UNCHANGED` because that was correct against whatever reference
 * target existed when the manifest was generated (2026-07-30); the real DEV
 * apply target is genuinely fresh for this one record, so the live plan
 * correctly resolves `CREATE` — this is the exact `UNEXPECTED_PLAN_ACTION`
 * failure recorded in `docs/migration/prelaunch-checklist.md` §G. Root-
 * caused as a single stale record, not an engine bug — the identical
 * correction is already applied ad hoc for a disposable fresh-schema run in
 * `scripts/phoenix-full-bundle-clean-run.ts`; this registry is the
 * reviewable, general, non-disposable equivalent.
 *
 * This is deliberately a narrow, itemized table, not a code change to
 * `UsersPhaseExecutor` or any other executor's manifest/live-plan
 * comparison — every other record's mismatch still fails closed exactly as
 * before, in every phase.
 */
export const PHOENIX_RELEASE_ACTION_EXCEPTIONS: readonly ReleaseActionException[] = [
  {
    phase: "users",
    sourceRecordKey: "wordpress-db:user:38",
    manifestDeclaredAction: "SKIP_UNCHANGED",
    correctedAction: "CREATE",
    reason:
      "Manifest frozen 2026-07-30 against a reference target where this user already existed; the real DEV apply " +
      "target is genuinely fresh for this one record. See docs/migration/prelaunch-checklist.md §G/§H.",
  },
];

/**
 * Applies narrowly-declared, exact-key release exceptions to a phase's
 * records before execution. Every exception is checked against the
 * manifest's CURRENT declared action for that exact key — fails closed if
 * the manifest no longer declares what the exception expects, rather than
 * silently overriding whatever is there (manifest drift must be re-reviewed
 * by a human, never silently re-applied). Applies unconditionally to every
 * apply/rerun (continuation or not) — this corrects a stale manifest
 * record, it is not continuation-specific behavior. Never touches the
 * committed manifest file or its hash; the correction exists only in the
 * in-memory manifest object handed to the adapters that execute writes.
 */
export function applyReleaseActionExceptions(phase: PhoenixReleasePhase): PhoenixReleasePhase {
  const applicable = PHOENIX_RELEASE_ACTION_EXCEPTIONS.filter((exception) => exception.phase === phase.name);
  if (applicable.length === 0) return phase;

  const records = phase.records.map((record) => {
    const exception = applicable.find((item) => item.sourceRecordKey === record.sourceRecordKey);
    if (!exception) return record;
    if (record.action !== exception.manifestDeclaredAction) {
      throw blocked(`CONTINUATION_RELEASE_EXCEPTION_STALE:${exception.sourceRecordKey}`);
    }
    return { ...record, action: exception.correctedAction };
  });
  return { ...phase, records };
}

// ---------------------------------------------------------------------------
// Continuation chain evidence — sanitized provenance recorded into the
// continuation run's own PhoenixPhaseReport(s) via `resolvedIdentities`.
// ---------------------------------------------------------------------------

export interface ContinuationEvidenceInput {
  predecessorCodeSha: string;
  predecessorReportSha256: string;
  predecessorTerminalFailedKey: string;
  skippedCompletedPrefixCount: number;
  continuationStartKey: string;
}

/**
 * Builds the flat string map merged into every report line's
 * `resolvedIdentities` field for a continuation run (see `coordinator.ts`'s
 * `continuationEvidence` input). Deliberately carries only derived scalar
 * summary fields — never raw predecessor report lines or private data — so
 * this stays safe to persist verbatim in the durable JSONL report.
 */
export function buildContinuationEvidence(input: ContinuationEvidenceInput): Record<string, string> {
  return {
    continuationPredecessorCodeSha: input.predecessorCodeSha,
    continuationPredecessorReportSha256: input.predecessorReportSha256,
    continuationPredecessorTerminalFailedKey: input.predecessorTerminalFailedKey,
    continuationSkippedCompletedPrefixCount: String(input.skippedCompletedPrefixCount),
    continuationStartKey: input.continuationStartKey,
  };
}
