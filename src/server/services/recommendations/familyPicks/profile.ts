import "server-only";

import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { childScopeFor } from "@/server/family/familyAccess";

const childSelect = {
  id: true,
  name: true,
  birthDate: true,
  birthPrecision: true,
  systemInterests: { select: { interestSlug: true } },
} satisfies Prisma.ChildSelect;

export type FamilyPicksProfileChild = Prisma.ChildGetPayload<{ select: typeof childSelect }>;
export type FamilyPicksAudience = "guest" | "no_child_with_DOB" | "personalized";
export type FamilyPicksProfile = {
  userId: string | null;
  audience: FamilyPicksAudience;
  children: FamilyPicksProfileChild[];
};

// Narrow ports let tests exercise failures and changing ACLs without a live DB.
type ProfileDependencies = {
  childScopeFor: typeof childScopeFor;
  findChildren: (where: Prisma.ChildWhereInput) => Promise<FamilyPicksProfileChild[]>;
};
const dependencies: ProfileDependencies = {
  childScopeFor,
  findChildren: (where) => prisma.child.findMany({ where, select: childSelect }),
};

/** Call after getCurrentUser. Never cache across requests/accounts or write a recommendation run.
 * All children remain in the snapshot, including incomplete profiles. DOB presence selects
 * the audience only: it is NOT proof of age fit (especially for MONTH precision).
 * ACL/DB errors deliberately propagate; they must not become "no children".
 */
export async function loadFamilyPicksProfile(
  userId: string | null,
  deps: ProfileDependencies = dependencies,
): Promise<FamilyPicksProfile> {
  if (!userId) return { userId: null, audience: "guest", children: [] };
  const children = await deps.findChildren(await deps.childScopeFor(userId));
  return {
    userId,
    audience: children.some((child) => child.birthDate !== null) ? "personalized" : "no_child_with_DOB",
    children,
  };
}

/** Safe client context: no birth dates, interest history or inaccessible child identifiers. */
export function familyPicksProfileContext(profile: FamilyPicksProfile, selectedChildId: string | null = null) {
  return {
    audience: profile.audience,
    accountId: profile.userId,
    selectedChildId,
    children: profile.children.map((child) => ({
      id: child.id,
      name: child.name,
      hasBirthDate: child.birthDate !== null,
      birthPrecision: child.birthPrecision,
    })),
    // Acknowledging a selection is not an implementation of per-child recommendations.
    selectionApplied: false as const,
  };
}
