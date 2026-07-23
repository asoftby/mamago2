import type { PrismaClient } from "@prisma/client";

import {
  BUSINESS_OWNERSHIP_SOURCE_NAMESPACE,
  planBusinessOwnershipGolden,
  writeBusinessOwnershipGolden,
  type BusinessOwnershipGoldenAction,
  type BusinessOwnershipGoldenCandidate,
  type BusinessOwnershipGoldenReason,
} from "./BusinessOwnershipGoldenRunner";

/**
 * USERS Slice 8: sequential batch over the remaining `EXACT_LINK_CANDIDATE`
 * entries, reusing the exact Slice 7 golden write path per candidate — no
 * new write logic, no relaxed guards. Processes strictly one candidate at
 * a time and stops the moment one comes back `BLOCKED` (Rule 4: first
 * full write-run is sequential, stop-on-first-error, no automatic retry
 * or rollback). Already-written candidates are left as-is; nothing is
 * undone.
 */

export interface BusinessOwnershipBatchEntryResult {
  sourceRecordKey: string;
  action: BusinessOwnershipGoldenAction;
  reason: BusinessOwnershipGoldenReason | null;
  businessId: string | null;
}

export interface BusinessOwnershipBatchSummary {
  total: number;
  processed: number;
  create: number;
  skipUnchanged: number;
  blocked: number;
  stoppedEarly: boolean;
  results: readonly BusinessOwnershipBatchEntryResult[];
}

export interface BusinessOwnershipBatchOptions {
  /** Called after each candidate is processed — used for per-step delta auditing. Throwing here aborts the batch immediately. */
  afterEach?: (result: BusinessOwnershipBatchEntryResult, index: number) => Promise<void>;
}

export async function executeBusinessOwnershipBatch(
  prisma: PrismaClient,
  manifest: readonly BusinessOwnershipGoldenCandidate[],
  options: BusinessOwnershipBatchOptions = {},
  sourceNamespace: string = BUSINESS_OWNERSHIP_SOURCE_NAMESPACE,
): Promise<BusinessOwnershipBatchSummary> {
  const results: BusinessOwnershipBatchEntryResult[] = [];
  let create = 0;
  let skipUnchanged = 0;
  let blocked = 0;
  let stoppedEarly = false;

  for (let index = 0; index < manifest.length; index++) {
    const candidate = manifest[index];
    const plan = await planBusinessOwnershipGolden(prisma, candidate, sourceNamespace);
    const written = await writeBusinessOwnershipGolden(prisma, plan, sourceNamespace);
    const result: BusinessOwnershipBatchEntryResult = { sourceRecordKey: candidate.sourceRecordKey, action: written.action, reason: plan.reason, businessId: written.businessId };
    results.push(result);

    if (written.action === "CREATE") create += 1;
    else if (written.action === "SKIP_UNCHANGED") skipUnchanged += 1;
    else blocked += 1;

    if (options.afterEach) await options.afterEach(result, index);

    if (written.action === "BLOCKED") {
      stoppedEarly = true;
      break;
    }
  }

  return { total: manifest.length, processed: results.length, create, skipUnchanged, blocked, stoppedEarly, results };
}
