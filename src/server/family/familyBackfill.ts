import type { Prisma, PrismaClient } from "@prisma/client";

import { ensureFamilyForUser, findActiveFamilyId } from "./ensureFamily";

export const USER_BATCH_SIZE = 500;
export const EVENT_BATCH_SIZE = 10_000;

export class FamilyBackfillStop extends Error {
  constructor(
    message: string,
    readonly details: unknown,
  ) {
    super(message);
    this.name = "FamilyBackfillStop";
  }
}

export type FamilyBackfillReport = {
  dryRun: boolean;
  candidateUsers: number;
  familiesCreated: number;
  membershipsCreated: number;
  childrenUpdated: number;
  planItemsUpdated: number;
  /** Rows owned by deleted users (tombstones): intentionally left without a family. */
  skippedTombstoneChildren: number;
  skippedTombstonePlanItems: number;
};

/** Candidates: live users that already own a Child or a PlanItem. */
const candidateWhere: Prisma.UserWhereInput = {
  deletedAt: null,
  OR: [{ children: { some: {} } }, { planItems: { some: {} } }],
};

/**
 * Gate: a PlanItem.childId pointing to a Child of another parent cannot be
 * assigned to a family without an explicit rule. Never guess: stop before any write.
 */
export async function assertNoCrossOwnerPlanChild(prisma: PrismaClient): Promise<void> {
  const rows = await prisma.$queryRaw<
    Array<{ planItemId: string; planUserId: string; childParentId: string }>
  >`
    SELECT p."id" AS "planItemId", p."userId" AS "planUserId", c."parentId" AS "childParentId"
    FROM "PlanItem" p
    JOIN "Child" c ON c."id" = p."childId"
    WHERE p."childId" IS NOT NULL AND p."userId" <> c."parentId"
    LIMIT 20`;
  if (rows.length > 0) {
    throw new FamilyBackfillStop(
      "cross_owner_plan_child: PlanItem.userId != Child.parentId; backfill stopped, resolve manually",
      rows,
    );
  }
}

/** Idempotent. `dryRun` performs reads only and reports what would change. */
export async function runFamilyBackfill(
  prisma: PrismaClient,
  options: { dryRun: boolean },
): Promise<FamilyBackfillReport> {
  await assertNoCrossOwnerPlanChild(prisma);

  const report: FamilyBackfillReport = {
    dryRun: options.dryRun,
    candidateUsers: 0,
    familiesCreated: 0,
    membershipsCreated: 0,
    childrenUpdated: 0,
    planItemsUpdated: 0,
    skippedTombstoneChildren: await prisma.child.count({
      where: { familyId: null, parent: { deletedAt: { not: null } } },
    }),
    skippedTombstonePlanItems: await prisma.planItem.count({
      where: { familyId: null, user: { deletedAt: { not: null } } },
    }),
  };

  let cursor: string | undefined;
  for (;;) {
    const users = await prisma.user.findMany({
      where: candidateWhere,
      select: { id: true },
      orderBy: { id: "asc" },
      take: USER_BATCH_SIZE,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
    if (users.length === 0) break;
    cursor = users[users.length - 1].id;
    report.candidateUsers += users.length;

    for (const { id: userId } of users) {
      let familyId = await findActiveFamilyId(prisma, userId);
      if (!familyId) {
        report.familiesCreated += 1;
        report.membershipsCreated += 1;
        if (!options.dryRun) familyId = await ensureFamilyForUser(prisma, userId);
      }
      if (options.dryRun || !familyId) {
        report.childrenUpdated += await prisma.child.count({
          where: { parentId: userId, familyId: null },
        });
        report.planItemsUpdated += await prisma.planItem.count({
          where: { userId, familyId: null },
        });
        continue;
      }
      const children = await prisma.child.updateMany({
        where: { parentId: userId, familyId: null },
        data: { familyId },
      });
      // createdById only where unknown; never overwritten, never used as ACL.
      await prisma.child.updateMany({
        where: { parentId: userId, createdById: null },
        data: { createdById: userId },
      });
      const items = await prisma.planItem.updateMany({
        where: { userId, familyId: null },
        data: { familyId },
      });
      report.childrenUpdated += children.count;
      report.planItemsUpdated += items.count;
    }
    if (users.length < USER_BATCH_SIZE) break;
  }
  return report;
}

export type EventsBackfillReport = { dryRun: boolean; eventsUpdated: number; batches: number };

/**
 * Historical UserEvent.familyId. Run LAST, only after the main backfill.
 * Assigned only where user -> family is unambiguous: the user has exactly one
 * FamilyMembership row ever. Plan audience and all other fields are left as-is.
 * Resumable: only rows with familyId IS NULL are touched.
 */
export async function runEventsBackfill(
  prisma: PrismaClient,
  options: { dryRun: boolean },
): Promise<EventsBackfillReport> {
  const pendingChildren = await prisma.child.count({
    where: { familyId: null, parent: { deletedAt: null } },
  });
  const pendingItems = await prisma.planItem.count({
    where: { familyId: null, user: { deletedAt: null } },
  });
  if (pendingChildren > 0 || pendingItems > 0) {
    throw new FamilyBackfillStop(
      "events backfill must run after the main backfill (Child/PlanItem without familyId remain)",
      { pendingChildren, pendingItems },
    );
  }

  if (options.dryRun) {
    const [{ count }] = await prisma.$queryRaw<Array<{ count: bigint }>>`
      WITH single AS (
        SELECT "userId" FROM "FamilyMembership" GROUP BY "userId" HAVING count(*) = 1
      )
      SELECT count(*) AS count
      FROM "UserEvent" e JOIN single s ON s."userId" = e."userId"
      WHERE e."familyId" IS NULL`;
    return { dryRun: true, eventsUpdated: Number(count), batches: 0 };
  }

  let eventsUpdated = 0;
  let batches = 0;
  for (;;) {
    const updated = await prisma.$executeRaw`
      WITH single AS (
        SELECT "userId", min("familyId") AS "familyId"
        FROM "FamilyMembership" GROUP BY "userId" HAVING count(*) = 1
      ),
      batch AS (
        SELECT e."id", s."familyId"
        FROM "UserEvent" e JOIN single s ON s."userId" = e."userId"
        WHERE e."familyId" IS NULL
        LIMIT ${EVENT_BATCH_SIZE}
      )
      UPDATE "UserEvent" e SET "familyId" = b."familyId"
      FROM batch b WHERE e."id" = b."id"`;
    if (updated === 0) break;
    eventsUpdated += updated;
    batches += 1;
  }
  return { dryRun: false, eventsUpdated, batches };
}
