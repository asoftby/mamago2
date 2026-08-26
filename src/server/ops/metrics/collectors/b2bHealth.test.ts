/**
 * b2bHealth collector test — active = ACTIVE business with >=1 published
 * inventory; meaningful_action_rate is scoped to that same set, over a
 * stated trailing-30d window.
 *
 * Runs against a live (shared) dev database that may already contain real
 * businesses, so assertions compare BEFORE/AFTER deltas from this test's
 * own fixtures rather than absolute counts.
 *
 * Run: DATABASE_URL=<isolated-db-url> npx tsx src/server/ops/metrics/collectors/b2bHealth.test.ts
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { collectB2BHealth } from "./b2bHealth";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  throw new Error("DATABASE_URL must point at an isolated test database");
}

const marker = randomUUID().slice(0, 8);
const businessIds: string[] = [];
const placeIds: string[] = [];
const userIds: string[] = [];
const eventIds: string[] = [];
const DAY_MS = 24 * 60 * 60 * 1000;

function valueOf(samples: { metric: string; value: number }[], metric: string): number {
  return samples.find((s) => s.metric === metric)?.value ?? 0;
}

function derivedActedCount(samples: { metric: string; value: number }[]): number {
  const active = valueOf(samples, "b2b.active_businesses");
  const rateSample = samples.find((s) => s.metric === "b2b.meaningful_action_rate");
  if (!rateSample) return 0;
  return Math.round(rateSample.value * active);
}

async function main() {
  const prisma = new PrismaClient({ datasourceUrl: DATABASE_URL });

  try {
    const now = new Date();
    const before = await collectB2BHealth({ prisma, now });

    async function makeOwnerAndBusiness(operationalStatus: "ACTIVE" | "DISABLED", createdAt: Date) {
      const owner = await prisma.user.create({ data: { email: `b2b-test-${marker}-${randomUUID()}@example.invalid` } });
      userIds.push(owner.id);
      const business = await prisma.business.create({
        data: { name: `B2B test ${marker}-${randomUUID()}`, ownerUserId: owner.id, operationalStatus, createdAt },
      });
      businessIds.push(business.id);
      return { ownerId: owner.id, businessId: business.id };
    }

    async function makePublishedPlace(ownerBusinessId: string, createdByUserId: string) {
      const place = await prisma.place.create({
        data: {
          title: `B2B test place ${marker}-${randomUUID()}`,
          shortDesc: "test",
          createdByUserId,
          status: "PUBLISHED",
          ownerBusinessId,
        },
      });
      placeIds.push(place.id);
      return place.id;
    }

    const oldCreatedAt = new Date(now.getTime() - 40 * DAY_MS);

    // Active, with published inventory, no action -> counts toward denominator only.
    const noAction = await makeOwnerAndBusiness("ACTIVE", oldCreatedAt);
    await makePublishedPlace(noAction.businessId, noAction.ownerId);

    // Active, with published inventory, AND a SAVE on that inventory within 30d -> counts toward numerator too.
    const actedOn = await makeOwnerAndBusiness("ACTIVE", oldCreatedAt);
    const actedPlaceId = await makePublishedPlace(actedOn.businessId, actedOn.ownerId);
    const saveEvent = await prisma.userEvent.create({
      data: {
        userId: actedOn.ownerId,
        eventType: "SAVE",
        entityType: "PLACE",
        entityId: actedPlaceId,
        createdAt: new Date(now.getTime() - 5 * DAY_MS),
      },
    });
    eventIds.push(saveEvent.id);

    // Active, NO published inventory -> must be excluded from both numerator and denominator.
    const noInventory = await makeOwnerAndBusiness("ACTIVE", oldCreatedAt);

    // DISABLED, with published inventory -> must be excluded (not ACTIVE).
    const disabled = await makeOwnerAndBusiness("DISABLED", oldCreatedAt);
    await makePublishedPlace(disabled.businessId, disabled.ownerId);

    // New business (created within the last 30 days) — no inventory, doesn't affect active_with_inventory.
    const newBiz = await makeOwnerAndBusiness("ACTIVE", new Date(now.getTime() - 5 * DAY_MS));
    void newBiz;

    const after = await collectB2BHealth({ prisma, now });

    const deltaActive = valueOf(after, "b2b.active_businesses") - valueOf(before, "b2b.active_businesses");
    const deltaActed = derivedActedCount(after) - derivedActedCount(before);
    const deltaNew30d = valueOf(after, "b2b.new_businesses_30d") - valueOf(before, "b2b.new_businesses_30d");

    assert.equal(deltaActive, 2, "only {noAction, actedOn} are ACTIVE with published inventory; noInventory + disabled excluded");
    assert.equal(deltaActed, 1, "only actedOn received a SAVE on its own published inventory in-window");
    assert.equal(deltaNew30d, 1, "only newBiz was created within the trailing 30 days");

    console.log("b2bHealth.test.ts: OK");
  } finally {
    await prisma.userEvent.deleteMany({ where: { id: { in: eventIds } } });
    await prisma.place.deleteMany({ where: { id: { in: placeIds } } });
    await prisma.business.deleteMany({ where: { id: { in: businessIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await prisma.$disconnect();
  }
}

main().then(
  () => process.exit(0),
  (err) => {
    console.error(err);
    process.exit(1);
  },
);
