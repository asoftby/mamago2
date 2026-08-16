/**
 * ReleaseEvent runtime observation (§21 Step 3, Phase I).
 *
 * Determines BUILD_CHANGED / PROCESS_RESTART relative to a persistent
 * comparison baseline stored on the singleton OperationsSnapshot payload
 * (`observedRuntime`) — never relative to "absence of a prior row".
 *
 * FIRST-OBSERVATION POLICY: `ReleaseEventKind` is frozen to exactly
 * BUILD_CHANGED | PROCESS_RESTART (Step 1 schema, no migration). There is
 * no third kind. Absence of a previous observation does NOT prove that a
 * deployment occurred: the first successful runtime observation only
 * establishes the baseline and creates NO ReleaseEvent. ReleaseEvent rows
 * are reserved exclusively for proven changes against that baseline:
 *
 *   - same buildId + changed processStartedAt → PROCESS_RESTART
 *   - changed buildId → BUILD_CHANGED
 *   - same runtime again → no event
 *   - worker restart while web runtime is unchanged → no event
 *     (baseline lives in OperationsSnapshot and survives worker reload)
 *
 * (buildId, processStartedAt) is unique at the DB level — concurrent/
 * overlapping workers observing the exact same changed runtime race
 * safely: one wins the insert, the other's unique-constraint violation is
 * treated as an idempotent no-op (baseline is still advanced).
 */
import { Prisma, type PrismaClient, type ReleaseEventKind } from "@prisma/client";

import type { OperationsSnapshotPayload, ObservedRuntimeBaseline } from "./snapshot/payload";

const UNIQUE_CONSTRAINT_VIOLATION = "P2002";

function isUniqueConstraintViolation(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === UNIQUE_CONSTRAINT_VIOLATION;
}

export interface ObservedRuntime {
  buildId: string;
  gitSha: string | null;
  processStartedAt: Date;
}

export interface ReleaseEventObservationResult {
  /** null when no proven change occurred (incl. first-ever baseline seed). */
  kind: ReleaseEventKind | null;
}

function toBaseline(observed: ObservedRuntime): ObservedRuntimeBaseline {
  return {
    buildId: observed.buildId,
    gitSha: observed.gitSha,
    processStartedAt: observed.processStartedAt.toISOString(),
  };
}

function parseBaseline(raw: unknown): ObservedRuntime | null {
  if (!raw || typeof raw !== "object") return null;
  const candidate = raw as Partial<ObservedRuntimeBaseline>;
  if (typeof candidate.buildId !== "string" || typeof candidate.processStartedAt !== "string") {
    return null;
  }
  const processStartedAt = new Date(candidate.processStartedAt);
  if (Number.isNaN(processStartedAt.getTime())) return null;
  return {
    buildId: candidate.buildId,
    gitSha: typeof candidate.gitSha === "string" ? candidate.gitSha : null,
    processStartedAt,
  };
}

async function readObservedRuntimeBaseline(prisma: PrismaClient): Promise<ObservedRuntime | null> {
  const snapshot = await prisma.operationsSnapshot.findUnique({ where: { id: "current" } });
  if (!snapshot) return null;
  const payload = snapshot.payload as OperationsSnapshotPayload | null;
  return parseBaseline(payload?.observedRuntime ?? null);
}

/**
 * Persist the comparison baseline on the singleton snapshot payload.
 * Updates only `payload.observedRuntime` when the row already exists
 * (does not bump startedAt/generatedAt). Creates a minimal singleton row
 * when none exists yet so the baseline survives across worker restarts
 * even before the first snapshot-builder cycle completes.
 */
async function writeObservedRuntimeBaseline(prisma: PrismaClient, observed: ObservedRuntime): Promise<void> {
  const baselineJson = JSON.stringify(toBaseline(observed));
  const emptyPayload = JSON.stringify({
    nodes: [],
    detectors: [],
    queues: {},
    kpis: {},
    release: null,
    observedRuntime: toBaseline(observed),
  });

  await prisma.$executeRaw`
    INSERT INTO "OperationsSnapshot"
      ("id", "generatedAt", "startedAt", "completedAt", "payload")
    VALUES (
      'current',
      clock_timestamp(),
      clock_timestamp(),
      clock_timestamp(),
      ${emptyPayload}::jsonb
    )
    ON CONFLICT ("id") DO UPDATE
    SET "payload" = jsonb_set(
      COALESCE("OperationsSnapshot"."payload", '{}'::jsonb),
      '{observedRuntime}',
      ${baselineJson}::jsonb
    )
  `;
}

function sameRuntime(a: ObservedRuntime, b: ObservedRuntime): boolean {
  return a.buildId === b.buildId && a.processStartedAt.getTime() === b.processStartedAt.getTime();
}

export async function observeReleaseEvent(
  prisma: PrismaClient,
  observed: ObservedRuntime,
): Promise<ReleaseEventObservationResult> {
  const baseline = await readObservedRuntimeBaseline(prisma);

  if (!baseline) {
    await writeObservedRuntimeBaseline(prisma, observed);
    return { kind: null };
  }

  if (sameRuntime(baseline, observed)) {
    return { kind: null };
  }

  const kind: ReleaseEventKind =
    baseline.buildId !== observed.buildId ? "BUILD_CHANGED" : "PROCESS_RESTART";

  try {
    await prisma.releaseEvent.create({
      data: {
        kind,
        buildId: observed.buildId,
        gitSha: observed.gitSha,
        processStartedAt: observed.processStartedAt,
      },
    });
    await writeObservedRuntimeBaseline(prisma, observed);
    return { kind };
  } catch (err) {
    if (isUniqueConstraintViolation(err)) {
      // Twin observer already recorded this exact runtime — still advance
      // the baseline so subsequent polls stay quiet.
      await writeObservedRuntimeBaseline(prisma, observed);
      return { kind: null };
    }
    throw err;
  }
}
