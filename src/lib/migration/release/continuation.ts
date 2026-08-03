import { readFileSync } from "node:fs";
import type { PrismaClient } from "@prisma/client";

import { exactExecutableKeys, sha256Bytes } from "./manifest";
import type {
  PhoenixEnvironmentContext,
  PhoenixExpectedRecord,
  PhoenixPhaseName,
  PhoenixPhaseReport,
  PhoenixReleaseManifest,
  PhoenixReleasePhase,
} from "./types";

function blocked(code: string): Error {
  return new Error(`RELEASE_BLOCKED:${code}`);
}

/** The complete database surface available to continuation-aware planning. */
export interface PhoenixContinuationReadClient {
  city: { findMany: PrismaClient["city"]["findMany"] };
  migrationLineage: { findMany: PrismaClient["migrationLineage"]["findMany"] };
  /**
   * Optional Offer/Place reads used only by the pinned Offers-partial hop
   * (`1ae265…` report). Older continuation hops never call these members.
   */
  offer?: {
    findMany: PrismaClient["offer"]["findMany"];
    findUnique: PrismaClient["offer"]["findUnique"];
  };
  place?: { findUnique: PrismaClient["place"]["findUnique"] };
}

type PhoenixLineageReadClient = Pick<PhoenixContinuationReadClient, "migrationLineage">;

export const PHOENIX_RELEASE_SOURCE_NAMESPACE = "phoenix-release-bundle";

/**
 * Maps an executable Phoenix phase to the `MigrationLineage.targetType`
 * its writer records identity under. Phases not listed here (currently
 * only `events`, which uses a differently-shaped adapter) are not
 * supported by continuation.
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
// predecessor progress report produced by an *older* code SHA than the one
// currently running. The report may now span multiple hops: zero or more
// fully-successful phase lines followed by exactly one failure line — see
// `loadCrossShaContinuationChain`.
// ---------------------------------------------------------------------------

const CODE_SHA_PATTERN = /^[0-9a-f]{40}$/;

/**
 * Explicit allowlist of predecessor code SHAs a cross-image continuation is
 * permitted to resume from. Deliberately not an open `--ignore-code-sha`
 * escape hatch and not "any SHA the operator names": extending this list to
 * a new predecessor requires a reviewed source change, never an
 * operator-supplied flag at run time. Every past image that ever produced a
 * report a later hop might need to continue from stays listed here
 * permanently — the list only ever grows.
 */
export const KNOWN_PREDECESSOR_CODE_SHAS: ReadonlySet<string> = new Set([
  // Original Phoenix DEV apply attempt (2026-08-03) that stopped cleanly at
  // wordpress-db:user:38 — see docs/migration/prelaunch-checklist.md §G.
  "f466c34c0cf095d054ae79d86a12505129719739",
  // First continuation hop (2026-08-03): completed Users (563/563) and
  // Businesses (38/38) in full, then stopped at wordpress-db:places:5528
  // (PLACE_CITY_DEPENDENCY_NOT_FOUND) — see §J.
  "2dc00b6026651c0d1b1008598a19a6833930820f",
  // Live-checkpoint Offers apply (2026-08-03/04): created 52 Offers then
  // stopped at wordpress-db:hb-programs:43659 (PLACE_DEPENDENCY_MISSING_CITY).
  // Users/Businesses/Places were already proven by the live checkpoint and
  // are therefore absent as prior report lines — see the Offers-partial pin.
  "1ae2658108fda224acd994021752ff52452e8cad",
]);

export const PHOENIX_SECOND_HOP_PREDECESSOR_REPORT_SHA256 =
  "257671d8dd039d803d5571cdcd0d00a8ddbdeaf4fba55c1a21b4f35850a9cfcc";
export const PHOENIX_SECOND_HOP_TERMINAL_KEY = "wordpress-db:places:5528";
export const PHOENIX_SECOND_HOP_COMPLETED_PREFIX: readonly PhoenixPhaseName[] = ["users", "businesses"];

export const PHOENIX_OFFERS_PARTIAL_PREDECESSOR_CODE_SHA = "1ae2658108fda224acd994021752ff52452e8cad";
export const PHOENIX_OFFERS_PARTIAL_REPORT_SHA256 =
  "5490cc2503b8f028c08b6e99181429090ee4fe332343f293ae7f41b0702d78bb";
export const PHOENIX_OFFERS_PARTIAL_TERMINAL_KEY = "wordpress-db:hb-programs:43659";
export const PHOENIX_OFFERS_PARTIAL_COMPLETED_COUNT = 52;
export const PHOENIX_OFFERS_PARTIAL_PLACE_SOURCE_RECORD_KEY = "wordpress-db:places:43635";
export const PHOENIX_OFFERS_PARTIAL_CITY_SLUG = "ratomka";
export const PHOENIX_OFFERS_PARTIAL_CITY_NAME = "Ратомка";
/** Phase-level completedPrefix on the single failure line (no prior report lines). */
export const PHOENIX_OFFERS_PARTIAL_COMPLETED_PREFIX: readonly PhoenixPhaseName[] = [];
export const PHOENIX_OFFERS_PARTIAL_PRIOR_PHASES: readonly PhoenixPhaseName[] = ["users", "businesses", "places"];

/**
 * The already-produced second-hop / Offers-partial reports are single reviewed
 * artifacts, not merely any byte sequence that happens to embed an allowlisted
 * code SHA. Pin digest and terminal state here. Remaining release/manifest/
 * environment/embedded-code identities are checked below against the
 * invocation's independently-derived expected values.
 */
function assertPinnedPredecessorArtifact(
  request: CrossShaContinuationRequest,
  failureReport: PhoenixPhaseReport,
  expectedReleaseId: string,
): void {
  if (expectedReleaseId !== "phoenix-approved-2026-07-30") return;

  if (request.predecessorCodeSha === "2dc00b6026651c0d1b1008598a19a6833930820f") {
    if (request.reportSha256.trim().toLowerCase() !== PHOENIX_SECOND_HOP_PREDECESSOR_REPORT_SHA256) {
      throw blocked("CONTINUATION_PREDECESSOR_REPORT_NOT_AUTHORIZED");
    }
    if (extractFailedKey(failureReport) !== PHOENIX_SECOND_HOP_TERMINAL_KEY) {
      throw blocked("CONTINUATION_PREDECESSOR_TERMINAL_KEY_MISMATCH");
    }
    if (JSON.stringify(failureReport.completedPrefix) !== JSON.stringify(PHOENIX_SECOND_HOP_COMPLETED_PREFIX)) {
      throw blocked("CONTINUATION_PREDECESSOR_COMPLETED_PREFIX_MISMATCH");
    }
    return;
  }

  if (request.predecessorCodeSha === PHOENIX_OFFERS_PARTIAL_PREDECESSOR_CODE_SHA) {
    if (request.reportSha256.trim().toLowerCase() !== PHOENIX_OFFERS_PARTIAL_REPORT_SHA256) {
      throw blocked("CONTINUATION_PREDECESSOR_REPORT_NOT_AUTHORIZED");
    }
    if (failureReport.phase !== "offers") throw blocked("CONTINUATION_OFFERS_PARTIAL_PHASE_MISMATCH");
    if (failureReport.failed !== 1) throw blocked("CONTINUATION_OFFERS_PARTIAL_FAILURE_COUNT_MISMATCH");
    if (failureReport.created !== PHOENIX_OFFERS_PARTIAL_COMPLETED_COUNT || failureReport.updated !== 0) {
      throw blocked("CONTINUATION_OFFERS_PARTIAL_COMPLETED_COUNT_MISMATCH");
    }
    if (extractFailedKey(failureReport) !== PHOENIX_OFFERS_PARTIAL_TERMINAL_KEY) {
      throw blocked("CONTINUATION_PREDECESSOR_TERMINAL_KEY_MISMATCH");
    }
    if (JSON.stringify(failureReport.completedPrefix) !== JSON.stringify(PHOENIX_OFFERS_PARTIAL_COMPLETED_PREFIX)) {
      throw blocked("CONTINUATION_PREDECESSOR_COMPLETED_PREFIX_MISMATCH");
    }
  }
}

/** Report-shape match for the pinned Offers-partial hop (ignores digest). */
export function looksLikePhoenixOffersPartialFailure(failureReport: PhoenixPhaseReport): boolean {
  return (
    failureReport.codeSha === PHOENIX_OFFERS_PARTIAL_PREDECESSOR_CODE_SHA &&
    failureReport.phase === "offers" &&
    failureReport.failed === 1 &&
    failureReport.created === PHOENIX_OFFERS_PARTIAL_COMPLETED_COUNT &&
    failureReport.updated === 0 &&
    extractFailedKey(failureReport) === PHOENIX_OFFERS_PARTIAL_TERMINAL_KEY &&
    JSON.stringify(failureReport.completedPrefix) === JSON.stringify(PHOENIX_OFFERS_PARTIAL_COMPLETED_PREFIX)
  );
}

export function isPhoenixOffersPartialContinuation(input: {
  predecessorCodeSha: string;
  reportSha256: string;
  failureReport: PhoenixPhaseReport;
}): boolean {
  return (
    input.predecessorCodeSha === PHOENIX_OFFERS_PARTIAL_PREDECESSOR_CODE_SHA &&
    input.reportSha256.trim().toLowerCase() === PHOENIX_OFFERS_PARTIAL_REPORT_SHA256 &&
    looksLikePhoenixOffersPartialFailure(input.failureReport)
  );
}

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

function isWellFormedReportEntry(value: unknown): value is PhoenixPhaseReport {
  if (!value || typeof value !== "object") return false;
  const entry = value as Partial<PhoenixPhaseReport>;
  return (
    typeof entry.releaseId === "string" &&
    typeof entry.codeSha === "string" &&
    typeof entry.manifestHash === "string" &&
    typeof entry.phase === "string" &&
    typeof entry.created === "number" &&
    typeof entry.updated === "number" &&
    typeof entry.failed === "number" &&
    (typeof entry.firstFailure === "string" || entry.firstFailure === null) &&
    typeof entry.environmentFingerprint === "object" &&
    entry.environmentFingerprint !== null &&
    Array.isArray(entry.completedPrefix)
  );
}

function parseReportEntries(raw: string): PhoenixPhaseReport[] {
  const lines = raw.split("\n").filter((line) => line.trim().length > 0);
  if (lines.length === 0) throw blocked("CONTINUATION_REPORT_EMPTY");
  let entries: unknown[];
  try {
    entries = lines.map((line) => JSON.parse(line));
  } catch {
    throw blocked("CONTINUATION_REPORT_MALFORMED");
  }
  if (!entries.every(isWellFormedReportEntry)) throw blocked("CONTINUATION_REPORT_MALFORMED");
  return entries as PhoenixPhaseReport[];
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
 * The phases a real run actually produces a report line for, in order:
 * `runPhoenixRelease` silently `continue`s past `VALIDATION_ONLY` phases in
 * apply/rerun mode without ever calling an adapter or appending a report —
 * so a report chain must never expect a line for one. Mirrors that behavior
 * exactly, rather than re-deriving it differently here.
 */
function reportablePhaseOrder(manifest: PhoenixReleaseManifest): PhoenixPhaseName[] {
  return manifest.phaseOrder.filter((name) => {
    const phase = manifest.phases.find((item) => item.name === name);
    return phase !== undefined && phase.status !== "VALIDATION_ONLY";
  });
}

export interface CrossShaContinuationChain {
  /** The one phase report describing where the predecessor run stopped. */
  failureReport: PhoenixPhaseReport;
  /**
   * Every phase report line before the failure, in `phaseOrder` order —
   * each independently validated as a genuine, uncorrupted, fingerprint-
   * matching success. Empty for a first-hop continuation (failure in the
   * very first executable phase); one entry per fully-completed phase for
   * every later hop.
   */
  priorPhaseReports: readonly PhoenixPhaseReport[];
}

/**
 * Loads and fully authorizes a predecessor progress report for continuation
 * under a *different* (newer) code SHA. Every check fails closed; nothing
 * here mutates state or touches the database. This is the only way this
 * module accepts a report whose `codeSha` differs from the code currently
 * running — see `KNOWN_PREDECESSOR_CODE_SHAS`, which this never bypasses.
 *
 * The report file may contain more than one line: every phase that
 * completed successfully before the eventual failure gets its own report
 * line (`JsonLinesPhoenixReportStore` is append-only). The *last* line must
 * describe the failure; every line before it must be an independently
 * valid, uncorrupted success forming an exact, gap-free prefix of the
 * manifest's own reportable phase order — the same structural guarantee
 * `assertResume`/`resolveSafeResumePoint` already enforce for same-image
 * resume, checked again here because those functions' own `codeSha` check
 * is deliberately incompatible with a cross-image continuation (the prior
 * phases were legitimately produced by the *predecessor* image, not the
 * one running now).
 */
export function loadCrossShaContinuationChain(
  request: CrossShaContinuationRequest,
  expected: CrossShaContinuationExpected & { manifest: PhoenixReleaseManifest },
): CrossShaContinuationChain {
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

  const entries = parseReportEntries(raw);
  const failureReport = entries.at(-1)!;
  const priorPhaseReports = entries.slice(0, -1);
  assertPinnedPredecessorArtifact(request, failureReport, expected.releaseId);

  const checkIdentity = (report: PhoenixPhaseReport): void => {
    if (report.codeSha !== request.predecessorCodeSha) throw blocked("CONTINUATION_REPORT_CODE_SHA_MISMATCH");
    if (report.releaseId !== expected.releaseId) throw blocked("CONTINUATION_RELEASE_ID_MISMATCH");
    if (report.manifestHash !== expected.manifestHash) throw blocked("CONTINUATION_MANIFEST_HASH_MISMATCH");
    if (report.environment !== expected.environment.environment) throw blocked("CONTINUATION_ENVIRONMENT_MISMATCH");
    if (JSON.stringify(report.environmentFingerprint) !== JSON.stringify(expected.environment)) {
      throw blocked("CONTINUATION_ENVIRONMENT_FINGERPRINT_MISMATCH");
    }
  };

  checkIdentity(failureReport);
  // Validates the key is well-formed and present; the failure itself is
  // re-validated (`report.failed <= 0`) inside extractFailedKey.
  extractFailedKey(failureReport);

  const offersPartial = isPhoenixOffersPartialContinuation({
    predecessorCodeSha: request.predecessorCodeSha,
    reportSha256: request.reportSha256,
    failureReport,
  });

  const order = reportablePhaseOrder(expected.manifest);
  const failedPhaseIndex = order.indexOf(failureReport.phase);
  if (failedPhaseIndex < 0) throw blocked("CONTINUATION_FAILED_PHASE_NOT_IN_MANIFEST");
  const expectedPriorPhaseNames = offersPartial ? [] : order.slice(0, failedPhaseIndex);

  if (offersPartial && priorPhaseReports.length !== 0) {
    throw blocked("CONTINUATION_OFFERS_PARTIAL_UNEXPECTED_PRIOR_LINES");
  }

  if (priorPhaseReports.length !== expectedPriorPhaseNames.length) {
    throw blocked(
      `CONTINUATION_PRIOR_PHASE_COUNT_MISMATCH:expected=${expectedPriorPhaseNames.length}:actual=${priorPhaseReports.length}`,
    );
  }

  priorPhaseReports.forEach((report, index) => {
    checkIdentity(report);
    if (report.phase !== expectedPriorPhaseNames[index]) {
      throw blocked(`CONTINUATION_PRIOR_PHASE_ORDER_MISMATCH:${report.phase}`);
    }
    if (report.failed > 0) throw blocked(`CONTINUATION_PRIOR_PHASE_NOT_SUCCESSFUL:${report.phase}`);
    const expectedOwnPrefix = order.slice(0, index + 1);
    if (JSON.stringify(report.completedPrefix) !== JSON.stringify(expectedOwnPrefix)) {
      throw blocked(`CONTINUATION_PRIOR_PHASE_PREFIX_CORRUPTED:${report.phase}`);
    }
  });

  return { failureReport, priorPhaseReports };
}

export const PHOENIX_PLACE_CITY_PREREQUISITES = ["Копище", "Мир"] as const;

/** Checks all known Place City prerequisites together, before any release write. */
export async function assertPhoenixPlaceCityPrerequisites(
  prisma: Pick<PhoenixContinuationReadClient, "city">,
): Promise<void> {
  const rows = await prisma.city.findMany({
    where: {
      name: { in: [...PHOENIX_PLACE_CITY_PREREQUISITES], mode: "insensitive" },
      isActive: true,
    },
    select: { id: true, name: true },
  });
  const normalized = (value: string) => value.trim().toLocaleLowerCase("ru");
  const missing: string[] = [];
  const ambiguous: string[] = [];
  for (const required of PHOENIX_PLACE_CITY_PREREQUISITES) {
    const matches = rows.filter((row) => normalized(row.name) === normalized(required));
    if (matches.length === 0) missing.push(required);
    if (matches.length > 1) ambiguous.push(required);
  }
  if (missing.length || ambiguous.length) {
    throw blocked(`PLACE_CITY_PREREQUISITES_UNSATISFIED:${JSON.stringify({ missing, ambiguous })}`);
  }
}

// ---------------------------------------------------------------------------
// Exact phase-completion proof — the sole mechanism that decides which
// records `SequentialEntityPhaseAdapter` is allowed to skip, for both a
// fully-completed prior phase and the one currently-failing phase.
// ---------------------------------------------------------------------------

/**
 * Proves — never assumes — that exactly `expectedKeys` (and nothing else)
 * has live, active `MigrationLineage` for this phase. Used both for a
 * phase that should be 100% done (`expectedKeys` = every executable key)
 * and for the partial prefix of the currently-failing phase (`expectedKeys`
 * = the keys before the failure). Every check fails closed:
 *  - a key inside `expectedKeys` whose manifest action is not CREATE/UPDATE
 *    cannot be proven complete purely from lineage existence (a SKIPPED
 *    outcome leaves no row) — this module never guesses;
 *  - any live lineage row for a key outside this phase's record set at all
 *    is unrelated/unexpected contamination;
 *  - any duplicate live lineage row for the same key is itself corruption;
 *  - a missing key inside `expectedKeys`, or any completed key outside it,
 *    both fail closed.
 */
async function resolvePhaseCompletion(
  prisma: PhoenixLineageReadClient,
  sourceNamespace: string,
  phase: PhoenixReleasePhase,
  expectedKeys: readonly string[],
  diagnosticKeyOnConflict?: string,
): Promise<ReadonlySet<string>> {
  const targetType = CONTINUATION_PHASE_TARGET_TYPE[phase.name];
  if (!targetType) throw blocked(`CONTINUATION_UNSUPPORTED_PHASE:${phase.name}`);

  const recordAction = new Map(phase.records.map((record) => [record.sourceRecordKey, record.action]));
  const ambiguousKey = expectedKeys.find((key) => {
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

  const missingKey = expectedKeys.find((key) => !seen.has(key));
  if (missingKey) throw blocked(`CONTINUATION_PREFIX_KEY_MISSING:${missingKey}`);

  const expectedKeySet = new Set(expectedKeys);
  const extraKey = [...seen].find((key) => !expectedKeySet.has(key));
  if (extraKey) {
    throw blocked(
      extraKey === diagnosticKeyOnConflict
        ? "CONTINUATION_FAILED_KEY_ALREADY_COMPLETE"
        : `CONTINUATION_UNEXPECTED_COMPLETED_KEY:${extraKey}`,
    );
  }

  return expectedKeySet;
}

export interface ExactPrefixContinuation {
  phase: PhoenixPhaseName;
  alreadyCompleted: ReadonlySet<string>;
  continuationStartKey: string;
}

/**
 * Proves the exact live-DB completed prefix of the currently-failing
 * phase's deterministic execution order (`exactExecutableKeys`). Does not
 * trust the predecessor report's own aggregate `created + updated` count as
 * authoritative (only as an upper-bound sanity signal — see the inline
 * comment below); the live `MigrationLineage` rows, checked
 * position-by-position against the manifest's own order, are what actually
 * gates the skip set.
 */
export async function resolveExactCompletedPrefix(
  prisma: PhoenixLineageReadClient,
  sourceNamespace: string,
  report: PhoenixPhaseReport,
  phase: PhoenixReleasePhase,
): Promise<ExactPrefixContinuation> {
  if (phase.name !== report.phase) throw blocked("CONTINUATION_PHASE_MISMATCH");

  const failedKey = extractFailedKey(report);
  const orderedKeys = exactExecutableKeys(phase);
  const failedIndex = orderedKeys.indexOf(failedKey);
  if (failedIndex < 0) throw blocked("CONTINUATION_FAILED_KEY_NOT_IN_MANIFEST");

  const expectedPrefix = orderedKeys.slice(0, failedIndex);
  const alreadyCompleted = await resolvePhaseCompletion(prisma, sourceNamespace, phase, expectedPrefix, failedKey);

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

  return { phase: phase.name, alreadyCompleted, continuationStartKey: failedKey };
}

/**
 * Proves a phase is *entirely* complete: live lineage must exactly equal
 * every executable key the manifest declares for it, no more, no less.
 * Used for every phase a continuation chain's prior report lines claim
 * finished successfully — never trusted from the report alone.
 */
export async function resolveFullPhaseCompletion(
  prisma: PhoenixLineageReadClient,
  sourceNamespace: string,
  phase: PhoenixReleasePhase,
): Promise<ReadonlySet<string>> {
  const orderedKeys = exactExecutableKeys(phase);
  return resolvePhaseCompletion(prisma, sourceNamespace, phase, orderedKeys);
}

// ---------------------------------------------------------------------------
// Multi-phase continuation orchestration — resolves the skip set for every
// phase a continuation chain covers: full skip sets for prior completed
// phases, plus the exact partial prefix for the one currently-failing
// phase. This is what makes a *second* (or later) continuation hop safe:
// without it, a plain `--apply` restarts at the first phase in
// `phaseOrder`, and a phase that is 100% done would immediately hit
// `UNEXPECTED_PLAN_ACTION` on its first record (the manifest's static
// action is stale the moment the live target actually exists).
// ---------------------------------------------------------------------------

export interface MultiPhaseContinuationResult {
  phaseSkipSets: ReadonlyMap<PhoenixPhaseName, ReadonlySet<string>>;
  failedPhase: PhoenixPhaseName;
  continuationStartKey: string;
}

export async function resolveMultiPhaseContinuation(
  prisma: PhoenixLineageReadClient,
  sourceNamespace: string,
  chain: CrossShaContinuationChain,
  manifest: PhoenixReleaseManifest,
  options?: { offersPartialReportSha256?: string },
): Promise<MultiPhaseContinuationResult> {
  const phaseSkipSets = new Map<PhoenixPhaseName, ReadonlySet<string>>();

  // Fail closed: a chain that looks like the pinned Offers-partial hop must
  // carry the authorized report digest. Omitting / mismatching the digest
  // must not silently degrade into a single-line offers continuation that
  // skips only the 52-offer prefix and never proves prior phases / Ratomka.
  if (looksLikePhoenixOffersPartialFailure(chain.failureReport)) {
    const digest = options?.offersPartialReportSha256?.trim().toLowerCase();
    if (!digest || digest !== PHOENIX_OFFERS_PARTIAL_REPORT_SHA256) {
      throw blocked("CONTINUATION_OFFERS_PARTIAL_REPORT_SHA_REQUIRED");
    }
  }

  const offersPartial =
    options?.offersPartialReportSha256 !== undefined &&
    isPhoenixOffersPartialContinuation({
      predecessorCodeSha: chain.failureReport.codeSha,
      reportSha256: options.offersPartialReportSha256,
      failureReport: chain.failureReport,
    });

  // Live-checkpoint-originated Offers failure reports carry no prior phase
  // success lines. Prove Users/Businesses/Places complete from live lineage
  // so SequentialEntityPhaseAdapter skips them without writers.
  if (offersPartial) {
    for (const phaseName of PHOENIX_OFFERS_PARTIAL_PRIOR_PHASES) {
      const phase = manifest.phases.find((item) => item.name === phaseName);
      if (!phase) throw blocked(`CONTINUATION_PHASE_NOT_IN_MANIFEST:${phaseName}`);
      phaseSkipSets.set(phase.name, await resolveFullPhaseCompletion(prisma, sourceNamespace, phase));
    }
  }

  for (const priorReport of chain.priorPhaseReports) {
    const phase = manifest.phases.find((item) => item.name === priorReport.phase);
    if (!phase) throw blocked(`CONTINUATION_PHASE_NOT_IN_MANIFEST:${priorReport.phase}`);
    phaseSkipSets.set(phase.name, await resolveFullPhaseCompletion(prisma, sourceNamespace, phase));
  }

  const failedPhase = manifest.phases.find((item) => item.name === chain.failureReport.phase);
  if (!failedPhase) throw blocked(`CONTINUATION_PHASE_NOT_IN_MANIFEST:${chain.failureReport.phase}`);
  const partial = await resolveExactCompletedPrefix(prisma, sourceNamespace, chain.failureReport, failedPhase);
  if (offersPartial && partial.alreadyCompleted.size !== PHOENIX_OFFERS_PARTIAL_COMPLETED_COUNT) {
    throw blocked(
      `CONTINUATION_OFFERS_PARTIAL_LIVE_PREFIX_COUNT_MISMATCH:expected=${PHOENIX_OFFERS_PARTIAL_COMPLETED_COUNT}:actual=${partial.alreadyCompleted.size}`,
    );
  }
  if (offersPartial && partial.continuationStartKey !== PHOENIX_OFFERS_PARTIAL_TERMINAL_KEY) {
    throw blocked("CONTINUATION_OFFERS_PARTIAL_START_KEY_MISMATCH");
  }
  phaseSkipSets.set(partial.phase, partial.alreadyCompleted);

  return { phaseSkipSets, failedPhase: partial.phase, continuationStartKey: partial.continuationStartKey };
}

const CONTINUATION_AUDIT_TARGET_TYPE: Partial<Record<PhoenixPhaseName, string>> = {
  ...CONTINUATION_PHASE_TARGET_TYPE,
  events: "ACTIVITY",
};

/** Proves that no active lineage exists for any executable phase after the failed phase. */
export async function assertContinuationLaterPhasesUntouched(
  prisma: PhoenixLineageReadClient,
  sourceNamespace: string,
  manifest: PhoenixReleaseManifest,
  failedPhase: PhoenixPhaseName,
): Promise<void> {
  const failedIndex = manifest.phaseOrder.indexOf(failedPhase);
  if (failedIndex < 0) throw blocked(`CONTINUATION_PHASE_NOT_IN_MANIFEST:${failedPhase}`);

  for (const phaseName of manifest.phaseOrder.slice(failedIndex + 1)) {
    const phase = manifest.phases.find((item) => item.name === phaseName);
    if (!phase || phase.status === "VALIDATION_ONLY") continue;
    const targetType = CONTINUATION_AUDIT_TARGET_TYPE[phaseName];
    if (!targetType) throw blocked(`CONTINUATION_UNSUPPORTED_PHASE:${phaseName}`);
    const rows = await prisma.migrationLineage.findMany({
      where: { targetType: targetType as never, isActive: true, source: { sourceNamespace } },
      select: { sourceRecordKey: true },
    });
    if (rows.length > 0) {
      throw blocked(`CONTINUATION_LATER_PHASE_TOUCHED:${phaseName}:${rows[0].sourceRecordKey}`);
    }
  }
}

/**
 * Extra live invariants for the pinned Offers-partial hop only: Offer target
 * rows for the proven 52-key prefix, absence of Offer 43659, Place 43635
 * linked to City Ратомка/ratomka, and no duplicate OFFER targets.
 */
export async function assertPhoenixOffersPartialLiveInvariants(input: {
  prisma: PhoenixContinuationReadClient;
  sourceNamespace: string;
  manifest: PhoenixReleaseManifest;
  alreadyCompletedOffers: ReadonlySet<string>;
  continuationStartKey: string;
}): Promise<void> {
  if (!input.prisma.offer || !input.prisma.place) {
    throw blocked("CONTINUATION_OFFERS_PARTIAL_READ_CLIENT_INCOMPLETE");
  }
  if (input.continuationStartKey !== PHOENIX_OFFERS_PARTIAL_TERMINAL_KEY) {
    throw blocked("CONTINUATION_OFFERS_PARTIAL_START_KEY_MISMATCH");
  }
  if (input.alreadyCompletedOffers.size !== PHOENIX_OFFERS_PARTIAL_COMPLETED_COUNT) {
    throw blocked("CONTINUATION_OFFERS_PARTIAL_LIVE_PREFIX_COUNT_MISMATCH");
  }

  const offersPhase = input.manifest.phases.find((phase) => phase.name === "offers");
  if (!offersPhase) throw blocked("CONTINUATION_PHASE_NOT_IN_MANIFEST:offers");
  const orderedKeys = exactExecutableKeys(offersPhase);
  const expectedPrefix = orderedKeys.slice(0, PHOENIX_OFFERS_PARTIAL_COMPLETED_COUNT);
  if (expectedPrefix.length !== PHOENIX_OFFERS_PARTIAL_COMPLETED_COUNT) {
    throw blocked("CONTINUATION_OFFERS_PARTIAL_MANIFEST_PREFIX_MISMATCH");
  }
  for (const key of expectedPrefix) {
    if (!input.alreadyCompletedOffers.has(key)) throw blocked(`CONTINUATION_OFFERS_PARTIAL_PREFIX_KEY_MISSING:${key}`);
  }
  if (orderedKeys[PHOENIX_OFFERS_PARTIAL_COMPLETED_COUNT] !== PHOENIX_OFFERS_PARTIAL_TERMINAL_KEY) {
    throw blocked("CONTINUATION_OFFERS_PARTIAL_TERMINAL_INDEX_MISMATCH");
  }

  const offerTargets = await input.prisma.offer.findMany({
    where: { createRequestId: { in: [...expectedPrefix] } },
    select: { createRequestId: true, id: true },
  });
  if (offerTargets.length !== expectedPrefix.length) {
    throw blocked(
      `CONTINUATION_OFFERS_PARTIAL_TARGET_COUNT_MISMATCH:expected=${expectedPrefix.length}:actual=${offerTargets.length}`,
    );
  }
  const targetIds = offerTargets.map((row) => row.id);
  if (new Set(targetIds).size !== targetIds.length) throw blocked("CONTINUATION_OFFERS_PARTIAL_DUPLICATE_TARGET");
  const byRequest = new Set(offerTargets.map((row) => row.createRequestId));
  for (const key of expectedPrefix) {
    if (!byRequest.has(key)) throw blocked(`CONTINUATION_OFFERS_PARTIAL_TARGET_MISSING:${key}`);
  }

  const blockedOffer = await input.prisma.offer.findUnique({
    where: { createRequestId: PHOENIX_OFFERS_PARTIAL_TERMINAL_KEY },
    select: { id: true },
  });
  if (blockedOffer) throw blocked("CONTINUATION_OFFERS_PARTIAL_FAILED_KEY_TARGET_EXISTS");

  const placeLineages = await input.prisma.migrationLineage.findMany({
    where: {
      sourceRecordKey: PHOENIX_OFFERS_PARTIAL_PLACE_SOURCE_RECORD_KEY,
      targetType: "PLACE" as never,
      isActive: true,
      source: { sourceNamespace: input.sourceNamespace },
    },
    select: { targetId: true },
  });
  if (placeLineages.length !== 1 || !placeLineages[0].targetId) {
    throw blocked("CONTINUATION_OFFERS_PARTIAL_PLACE_LINEAGE_MISMATCH");
  }
  const place = await input.prisma.place.findUnique({
    where: { id: placeLineages[0].targetId },
    select: { id: true, cityId: true, city: { select: { slug: true, name: true, isActive: true } } },
  });
  if (!place) throw blocked("CONTINUATION_OFFERS_PARTIAL_PLACE_TARGET_MISSING");
  if (!place.cityId || !place.city) throw blocked("CONTINUATION_OFFERS_PARTIAL_PLACE_CITY_MISSING");
  if (
    place.city.slug !== PHOENIX_OFFERS_PARTIAL_CITY_SLUG ||
    place.city.name !== PHOENIX_OFFERS_PARTIAL_CITY_NAME ||
    !place.city.isActive
  ) {
    throw blocked("CONTINUATION_OFFERS_PARTIAL_PLACE_CITY_MISMATCH");
  }
}

export interface ContinuationAwarePlanResult {
  mode: "CONTINUATION_READ_ONLY_PLAN";
  status: "READY" | "BLOCKED";
  releaseId: string;
  manifestHash: string;
  codeSha: string;
  predecessorCodeSha: string;
  predecessorReportSha256: string;
  completed: Partial<Record<PhoenixPhaseName, readonly string[]>>;
  continuationStartKey: string;
  laterPhasesUntouched: true;
  cityPrerequisites: { missing: string[]; ambiguous: string[] };
  writesAttempted: 0;
}

/**
 * Live continuation preflight. Its deliberately tiny client type makes entity,
 * migration-record/run and report writes unavailable at compile time.
 */
export async function runContinuationAwarePlan(input: {
  prisma: PhoenixContinuationReadClient;
  request: CrossShaContinuationRequest;
  expected: CrossShaContinuationExpected & { manifest: PhoenixReleaseManifest };
}): Promise<ContinuationAwarePlanResult> {
  const chain = loadCrossShaContinuationChain(input.request, input.expected);
  return evaluateContinuationAwarePlan({ ...input, chain });
}

/** Pure live-state evaluation after predecessor-file identity authorization. */
export async function evaluateContinuationAwarePlan(input: {
  prisma: PhoenixContinuationReadClient;
  request: CrossShaContinuationRequest;
  expected: CrossShaContinuationExpected & { manifest: PhoenixReleaseManifest };
  chain: CrossShaContinuationChain;
}): Promise<ContinuationAwarePlanResult> {
  const continuation = await resolveMultiPhaseContinuation(
    input.prisma,
    PHOENIX_RELEASE_SOURCE_NAMESPACE,
    input.chain,
    input.expected.manifest,
    { offersPartialReportSha256: input.request.reportSha256 },
  );
  await assertContinuationLaterPhasesUntouched(
    input.prisma,
    PHOENIX_RELEASE_SOURCE_NAMESPACE,
    input.expected.manifest,
    continuation.failedPhase,
  );

  if (
    isPhoenixOffersPartialContinuation({
      predecessorCodeSha: input.request.predecessorCodeSha,
      reportSha256: input.request.reportSha256,
      failureReport: input.chain.failureReport,
    })
  ) {
    await assertPhoenixOffersPartialLiveInvariants({
      prisma: input.prisma,
      sourceNamespace: PHOENIX_RELEASE_SOURCE_NAMESPACE,
      manifest: input.expected.manifest,
      alreadyCompletedOffers: continuation.phaseSkipSets.get("offers") ?? new Set(),
      continuationStartKey: continuation.continuationStartKey,
    });
  }

  let cityPrerequisites = { missing: [] as string[], ambiguous: [] as string[] };
  try {
    await assertPhoenixPlaceCityPrerequisites(input.prisma);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const marker = "RELEASE_BLOCKED:PLACE_CITY_PREREQUISITES_UNSATISFIED:";
    if (!message.startsWith(marker)) throw error;
    cityPrerequisites = JSON.parse(message.slice(marker.length)) as typeof cityPrerequisites;
  }

  return {
    mode: "CONTINUATION_READ_ONLY_PLAN",
    status: cityPrerequisites.missing.length || cityPrerequisites.ambiguous.length ? "BLOCKED" : "READY",
    releaseId: input.expected.releaseId,
    manifestHash: input.expected.manifestHash,
    codeSha: input.expected.currentCodeSha,
    predecessorCodeSha: input.request.predecessorCodeSha,
    predecessorReportSha256: input.request.reportSha256,
    completed: Object.fromEntries(
      [...continuation.phaseSkipSets].map(([phase, keys]) => [phase, [...keys]]),
    ) as ContinuationAwarePlanResult["completed"],
    continuationStartKey: continuation.continuationStartKey,
    laterPhasesUntouched: true,
    cityPrerequisites,
    writesAttempted: 0,
  };
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
 * before, in every phase. `wordpress-db:places:5528` (missing City
 * `Копище`) and `wordpress-db:places:32271` (missing City `Мир`, not yet
 * reached) are deliberately **not** listed here — see §J: that failure is
 * a missing-prerequisite (City rows absent from DEV), not a stale-manifest
 * mismatch, and does not fit this table's shape at all.
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
  /**
   * The code SHA of the *original* run this whole continuation chain traces
   * back to, however many hops ago. Equal to `predecessorCodeSha` for a
   * first-hop continuation; carried forward unchanged (not re-derived) by
   * `chainOriginCodeSha` for every later hop, so a report always shows the
   * full chain's true starting point, not just its immediate predecessor.
   */
  chainOriginCodeSha: string;
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
    continuationChainOriginCodeSha: input.chainOriginCodeSha,
  };
}

/**
 * Extracts the chain's true origin code SHA from a predecessor failure
 * report: if that report was itself produced by an earlier continuation
 * (its own `resolvedIdentities.continuationChainOriginCodeSha` is set),
 * that value is the real origin — otherwise this predecessor *is* the
 * origin (a first-hop continuation).
 */
export function resolveChainOriginCodeSha(failureReport: PhoenixPhaseReport, predecessorCodeSha: string): string {
  const inherited = failureReport.resolvedIdentities?.continuationChainOriginCodeSha;
  return typeof inherited === "string" && inherited.length > 0 ? inherited : predecessorCodeSha;
}
