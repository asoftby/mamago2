/**
 * Regression tests for the HomeStoryItem.isFree fix: the wizard's free
 * pricing mode clears `priceFrom` and instead sets
 * `scheduleJson.pricingMode="free"` / `priceText="бесплатно"`, so deriving
 * `isFree` from `priceFrom === 0` alone silently dropped legit free events
 * from the "Бесплатно" Story. See `isStructuredFreeEvent`
 * (eventFilterSemantics.ts) and `syncEventHomeStoriesProjection.ts`.
 *
 * Self-generated fixtures against the local dev DB, created and torn down
 * within this file, per project convention.
 *
 * Запуск: set -a; source .env; set +a; npx tsx src/server/stories/syncEventHomeStoriesProjection.test.ts
 */
import assert from "node:assert/strict";
import {
  ActivityType,
  ContentStatus,
  HomeStoryItemStatus,
  HomeStoryPlacementType,
  HomeStorySourceType,
  ScheduleMode,
} from "@prisma/client";
import prisma from "@/lib/prisma";
import { syncEventHomeStoriesProjection } from "./syncEventHomeStoriesProjection";

const TITLE_PREFIX = "TEST-FIXTURE-syncEventHomeStoriesProjection-";

async function cleanupActivity(activityId: string) {
  await prisma.homeStoryItem.deleteMany({ where: { sourceType: HomeStorySourceType.EVENT, sourceId: activityId } });
  await prisma.activitySession.deleteMany({ where: { activityId } });
  await prisma.activity.deleteMany({ where: { id: activityId } });
}

async function createActivity(input: {
  title: string;
  cityId: string;
  ownerUserId: string;
  status?: ContentStatus;
  priceFrom?: number | null;
  priceText?: string | null;
  scheduleJson?: unknown;
  sessionStartsAt?: Date[];
}) {
  return prisma.activity.create({
    data: {
      title: input.title,
      shortDesc: "fixture",
      type: ActivityType.EVENT,
      scheduleMode: ScheduleMode.ONE_TIME,
      status: input.status ?? ContentStatus.PUBLISHED,
      cityId: input.cityId,
      ownerUserId: input.ownerUserId,
      priceFrom: input.priceFrom ?? null,
      priceText: input.priceText ?? null,
      scheduleJson: (input.scheduleJson ?? undefined) as never,
      sessions: input.sessionStartsAt
        ? { create: input.sessionStartsAt.map((startsAt) => ({ startsAt })) }
        : undefined,
    },
    select: { id: true },
  });
}

async function isFreeOf(activityId: string): Promise<boolean[]> {
  const items = await prisma.homeStoryItem.findMany({
    where: { sourceType: HomeStorySourceType.EVENT, sourceId: activityId, status: HomeStoryItemStatus.ACTIVE },
    select: { isFree: true },
  });
  return items.map((i) => i.isFree);
}

async function main() {
  const city = await prisma.city.findFirstOrThrow({ where: { slug: "minsk" }, select: { id: true } });
  const owner = await prisma.user.findFirstOrThrow({ select: { id: true } });
  const future = (daysFromNow: number) => new Date(Date.now() + daysFromNow * 86_400_000);
  const createdIds: string[] = [];

  try {
    // 1. pricingMode="free" via scheduleJson, priceFrom null.
    {
      const a = await createActivity({
        title: `${TITLE_PREFIX}pricingMode-free`, cityId: city.id, ownerUserId: owner.id,
        scheduleJson: { pricingMode: "free" }, sessionStartsAt: [future(2)],
      });
      createdIds.push(a.id);
      await syncEventHomeStoriesProjection(a.id);
      assert.deepEqual(await isFreeOf(a.id), [true], "scheduleJson.pricingMode=free must be free");
    }

    // 2. Legacy free: priceFrom=0.
    {
      const a = await createActivity({
        title: `${TITLE_PREFIX}legacy-price-zero`, cityId: city.id, ownerUserId: owner.id,
        priceFrom: 0, sessionStartsAt: [future(2)],
      });
      createdIds.push(a.id);
      await syncEventHomeStoriesProjection(a.id);
      assert.deepEqual(await isFreeOf(a.id), [true], "priceFrom=0 must stay free");
    }

    // 3. Free by priceText only.
    {
      const a = await createActivity({
        title: `${TITLE_PREFIX}free-by-text`, cityId: city.id, ownerUserId: owner.id,
        priceText: "Бесплатно", sessionStartsAt: [future(2)],
      });
      createdIds.push(a.id);
      await syncEventHomeStoriesProjection(a.id);
      assert.deepEqual(await isFreeOf(a.id), [true], "priceText='Бесплатно' must be free");
    }

    // 4. Paid fixed must not be free.
    {
      const a = await createActivity({
        title: `${TITLE_PREFIX}paid-fixed`, cityId: city.id, ownerUserId: owner.id,
        priceFrom: 25, scheduleJson: { pricingMode: "fixed" }, sessionStartsAt: [future(2)],
      });
      createdIds.push(a.id);
      await syncEventHomeStoriesProjection(a.id);
      assert.deepEqual(await isFreeOf(a.id), [false], "fixed paid price must not be free");
    }

    // 5. Paid "from" must not be free.
    {
      const a = await createActivity({
        title: `${TITLE_PREFIX}paid-from`, cityId: city.id, ownerUserId: owner.id,
        priceFrom: 10, scheduleJson: { pricingMode: "from" }, sessionStartsAt: [future(2)],
      });
      createdIds.push(a.id);
      await syncEventHomeStoriesProjection(a.id);
      assert.deepEqual(await isFreeOf(a.id), [false], "'from' pricing with a price must not be free");
    }

    // 6. Existing wrong projection (isFree=false) gets repaired on re-sync.
    {
      const a = await createActivity({
        title: `${TITLE_PREFIX}repair-wrong-projection`, cityId: city.id, ownerUserId: owner.id,
        scheduleJson: { pricingMode: "free" }, sessionStartsAt: [future(2)],
      });
      createdIds.push(a.id);
      await syncEventHomeStoriesProjection(a.id);
      const before = await prisma.homeStoryItem.findFirstOrThrow({ where: { sourceType: HomeStorySourceType.EVENT, sourceId: a.id } });
      await prisma.homeStoryItem.update({ where: { id: before.id }, data: { isFree: false } });
      assert.deepEqual(await isFreeOf(a.id), [false], "sanity: corrupted to false before repair");
      await syncEventHomeStoriesProjection(a.id);
      assert.deepEqual(await isFreeOf(a.id), [true], "re-sync must repair a stale isFree=false row");
    }

    // 7. Idempotency: repeated sync does not duplicate rows.
    {
      const a = await createActivity({
        title: `${TITLE_PREFIX}idempotent`, cityId: city.id, ownerUserId: owner.id,
        scheduleJson: { pricingMode: "free" }, sessionStartsAt: [future(2)],
      });
      createdIds.push(a.id);
      await syncEventHomeStoriesProjection(a.id);
      await syncEventHomeStoriesProjection(a.id);
      await syncEventHomeStoriesProjection(a.id);
      const rows = await prisma.homeStoryItem.findMany({ where: { sourceType: HomeStorySourceType.EVENT, sourceId: a.id } });
      assert.equal(rows.length, 1, "repeated sync must not create duplicate HomeStoryItem rows");
    }

    // 8. EXCLUDE placements are preserved across re-sync (editorial override).
    {
      const a = await createActivity({
        title: `${TITLE_PREFIX}exclude-preserved`, cityId: city.id, ownerUserId: owner.id,
        scheduleJson: { pricingMode: "free" }, sessionStartsAt: [future(2)],
      });
      createdIds.push(a.id);
      await syncEventHomeStoriesProjection(a.id);
      const row = await prisma.homeStoryItem.findFirstOrThrow({ where: { sourceType: HomeStorySourceType.EVENT, sourceId: a.id } });
      await prisma.homeStoryItem.update({ where: { id: row.id }, data: { placementType: HomeStoryPlacementType.EXCLUDE } });
      await syncEventHomeStoriesProjection(a.id);
      const after = await prisma.homeStoryItem.findFirstOrThrow({ where: { id: row.id } });
      assert.equal(after.placementType, HomeStoryPlacementType.EXCLUDE, "EXCLUDE must survive re-sync");
      assert.equal(after.status, HomeStoryItemStatus.ACTIVE, "EXCLUDE row must not be force-inactivated by re-sync");
    }

    // 9. A session removed from scheduleJson deactivates its old occurrence.
    {
      const s1 = future(2);
      const s2 = future(3);
      const a = await createActivity({
        title: `${TITLE_PREFIX}session-removed`, cityId: city.id, ownerUserId: owner.id,
        scheduleJson: { pricingMode: "free" }, sessionStartsAt: [s1, s2],
      });
      createdIds.push(a.id);
      await syncEventHomeStoriesProjection(a.id);
      assert.equal((await prisma.homeStoryItem.count({ where: { sourceType: HomeStorySourceType.EVENT, sourceId: a.id, status: HomeStoryItemStatus.ACTIVE } })), 2);
      // Simulate the wizard rebuilding sessions from scheduleJson with s2 dropped.
      await prisma.activitySession.deleteMany({ where: { activityId: a.id, startsAt: s2 } });
      await syncEventHomeStoriesProjection(a.id);
      const rows = await prisma.homeStoryItem.findMany({ where: { sourceType: HomeStorySourceType.EVENT, sourceId: a.id } });
      const active = rows.filter((r) => r.status === HomeStoryItemStatus.ACTIVE);
      const inactive = rows.filter((r) => r.status === HomeStoryItemStatus.INACTIVE);
      assert.equal(active.length, 1, "only the surviving occurrence stays ACTIVE");
      assert.equal(inactive.length, 1, "the removed occurrence becomes INACTIVE, not deleted");
    }

    // 10. Unpublishing the Activity deactivates all its projections.
    {
      const a = await createActivity({
        title: `${TITLE_PREFIX}unpublished`, cityId: city.id, ownerUserId: owner.id,
        scheduleJson: { pricingMode: "free" }, sessionStartsAt: [future(2)],
      });
      createdIds.push(a.id);
      await syncEventHomeStoriesProjection(a.id);
      assert.equal((await prisma.homeStoryItem.count({ where: { sourceType: HomeStorySourceType.EVENT, sourceId: a.id, status: HomeStoryItemStatus.ACTIVE } })), 1);
      await prisma.activity.update({ where: { id: a.id }, data: { status: ContentStatus.DRAFT } });
      await syncEventHomeStoriesProjection(a.id);
      assert.equal((await prisma.homeStoryItem.count({ where: { sourceType: HomeStorySourceType.EVENT, sourceId: a.id, status: HomeStoryItemStatus.ACTIVE } })), 0);
      assert.equal((await prisma.homeStoryItem.count({ where: { sourceType: HomeStorySourceType.EVENT, sourceId: a.id, status: HomeStoryItemStatus.INACTIVE } })), 1);
    }

    console.log("syncEventHomeStoriesProjection free-detection tests: OK");
  } finally {
    for (const id of createdIds) await cleanupActivity(id);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
}).finally(() => prisma.$disconnect());
