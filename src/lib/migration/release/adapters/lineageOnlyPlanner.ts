/**
 * Shared, entity-agnostic idempotency planner for the three remaining
 * fresh-DEV-target entities (Articles, Events, Routes). Unlike Offer,
 * none of `Article`/`Activity`/`Route` has a dedicated create-only
 * idempotency column (no `createRequestId` equivalent — verified against
 * `prisma/schema.prisma`), so target-state can only ever be known through
 * `MigrationLineage` itself: whether an active lineage row exists, and
 * whether the target row it names still exists. There is no independent
 * way to detect "a target exists with no lineage at all" the way Offer's
 * `Offer.createRequestId` lookup can — that CONFLICT case is structurally
 * unreachable for these three entities, not merely untested.
 *
 * This is the one planner all three entity adapters share, so the
 * CREATE/SKIP_UNCHANGED/CONFLICT/FAILED contract is defined exactly once
 * rather than re-implemented per entity.
 */

export interface LineageOnlyTargetState {
  lineageCount: number;
  /** Only meaningful when lineageCount === 1: does the lineage's own targetId still resolve to a real row? */
  targetExists: boolean;
  lineageDomainHash: string | null;
}

export type LineageOnlyPlanAction = "CREATE" | "SKIP_UNCHANGED" | "CONFLICT" | "FAILED";

export interface LineageOnlyPlanResult {
  action: LineageOnlyPlanAction;
  reason: string | null;
}

export function planLineageOnlyCreateAction(domainHash: string, target: LineageOnlyTargetState): LineageOnlyPlanResult {
  if (target.lineageCount > 1) return { action: "FAILED", reason: "DUPLICATE_LINEAGE" };
  if (target.lineageCount === 0) return { action: "CREATE", reason: null };
  if (!target.targetExists) return { action: "CONFLICT", reason: "LINEAGE_WITHOUT_TARGET" };
  if (target.lineageDomainHash !== domainHash) return { action: "CONFLICT", reason: "DOMAIN_HASH_CHANGED" };
  return { action: "SKIP_UNCHANGED", reason: null };
}
