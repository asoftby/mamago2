import { prisma } from "@/lib/prisma";
import { familyReadsEnabled } from "./familyScope";
import { mergeYoungestBirthDates } from "./familyAnalyticsPure";

/**
 * Youngest child's birth date per user. Legacy: children the user created
 * (`Child.parentId`). With FAMILY_CORE_READS on, every active adult also gets
 * the children of their family (so a co-parent is segmented by the shared kids).
 * Single-adult data yields identical results either way.
 */
export async function youngestChildBirthByUser(): Promise<Map<string, Date>> {
  const legacyRows = await prisma.$queryRaw<Array<{ userId: string; youngest: Date }>>`
    SELECT c."parentId" AS "userId", MAX(c."birthDate") AS youngest
    FROM "Child" c
    WHERE c."birthDate" IS NOT NULL
    GROUP BY c."parentId"
  `;
  const legacy = new Map(legacyRows.map((r) => [r.userId, r.youngest]));
  if (!familyReadsEnabled()) return legacy;

  const familyRows = await prisma.$queryRaw<Array<{ userId: string; youngest: Date }>>`
    SELECT m."userId", MAX(c."birthDate") AS youngest
    FROM "Child" c
    JOIN "FamilyMembership" m ON m."familyId" = c."familyId" AND m."leftAt" IS NULL
    WHERE c."birthDate" IS NOT NULL
    GROUP BY m."userId"
  `;
  return mergeYoungestBirthDates(legacy, new Map(familyRows.map((r) => [r.userId, r.youngest])));
}
