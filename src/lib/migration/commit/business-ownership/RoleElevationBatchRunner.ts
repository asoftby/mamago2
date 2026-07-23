import type { PrismaClient } from "@prisma/client";

import { planRoleElevationGolden, writeRoleElevationGolden, type RoleElevationAction, type RoleElevationGoldenCandidate, type RoleElevationReason } from "./RoleElevationGoldenRunner";

/**
 * USERS Slice 10: sequential batch over the remaining 35 role-elevation
 * candidates, reusing the exact Slice 9 write path per candidate — no new
 * write logic, no relaxed guards. Processes strictly one candidate at a
 * time and stops the moment one comes back `BLOCKED`. Already-elevated
 * candidates are left as-is; nothing is undone.
 */

export interface RoleElevationBatchEntryResult {
  sourceRecordKey: string;
  action: RoleElevationAction;
  reason: RoleElevationReason | null;
  targetUserId: string | null;
}

export interface RoleElevationBatchSummary {
  total: number;
  processed: number;
  elevate: number;
  skipUnchanged: number;
  blocked: number;
  stoppedEarly: boolean;
  results: readonly RoleElevationBatchEntryResult[];
}

export interface RoleElevationBatchOptions {
  /** Called after each candidate is processed — used for per-step delta auditing. Throwing here aborts the batch immediately. */
  afterEach?: (result: RoleElevationBatchEntryResult, index: number) => Promise<void>;
}

export async function executeRoleElevationBatch(
  prisma: PrismaClient,
  manifest: readonly RoleElevationGoldenCandidate[],
  options: RoleElevationBatchOptions = {},
  sourceNamespace?: string,
): Promise<RoleElevationBatchSummary> {
  const results: RoleElevationBatchEntryResult[] = [];
  let elevate = 0;
  let skipUnchanged = 0;
  let blocked = 0;
  let stoppedEarly = false;

  for (let index = 0; index < manifest.length; index++) {
    const candidate = manifest[index];
    const plan = sourceNamespace ? await planRoleElevationGolden(prisma, candidate, sourceNamespace) : await planRoleElevationGolden(prisma, candidate);
    const written = await writeRoleElevationGolden(prisma, plan);
    const result: RoleElevationBatchEntryResult = { sourceRecordKey: candidate.sourceRecordKey, action: written.action, reason: plan.reason, targetUserId: written.targetUserId };
    results.push(result);

    if (written.action === "ELEVATE") elevate += 1;
    else if (written.action === "SKIP_UNCHANGED") skipUnchanged += 1;
    else blocked += 1;

    if (options.afterEach) await options.afterEach(result, index);

    if (written.action === "BLOCKED") {
      stoppedEarly = true;
      break;
    }
  }

  return { total: manifest.length, processed: results.length, elevate, skipUnchanged, blocked, stoppedEarly, results };
}
