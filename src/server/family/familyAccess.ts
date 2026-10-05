import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

import { ensureFamilyForUser, findActiveFamilyId } from "./ensureFamily";
import {
  childScopeWhere,
  familyReadsEnabled,
  planItemScopeWhere,
  type FamilyScope,
} from "./familyScope";

import { NOT_CANCELLED } from "./familyScope";

export { NOT_CANCELLED, familyReadsEnabled } from "./familyScope";
export type { FamilyScope } from "./familyScope";

/** Family Core B2 DB-backed access helpers (pure fragments live in familyScope.ts). */
export async function resolveFamilyScope(userId: string): Promise<FamilyScope> {
  return { userId, familyId: await findActiveFamilyId(prisma, userId) };
}

/** Where fragment for PlanItem reads/dedup/deletes of this user (no DB hit when reads are off). */
export async function planScopeFor(userId: string): Promise<Prisma.PlanItemWhereInput> {
  if (!familyReadsEnabled()) return { userId };
  return planItemScopeWhere(await resolveFamilyScope(userId), true);
}

/**
 * ACL scope + not cancelled. Use ONLY for "is it actively in the plan / already
 * planned / dedup before adding" lookups. CANCELLED rows are history: they never
 * count as planned and are never reactivated by a new add. Plain ACL checks
 * (remove, ownership reads) keep using planScopeFor.
 */
export async function activePlanScopeFor(userId: string): Promise<Prisma.PlanItemWhereInput> {
  return { ...(await planScopeFor(userId)), ...NOT_CANCELLED };
}

/** Where fragment for Child reads/guards of this user. */
export async function childScopeFor(userId: string): Promise<Prisma.ChildWhereInput> {
  if (!familyReadsEnabled()) return { parentId: userId };
  return childScopeWhere(await resolveFamilyScope(userId), true);
}

/** Family id for writes: always ensured (lazy family on first family write). */
export async function familyIdForWrite(userId: string): Promise<string> {
  return ensureFamilyForUser(prisma, userId);
}
