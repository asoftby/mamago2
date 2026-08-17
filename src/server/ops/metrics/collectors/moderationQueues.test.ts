/**
 * moderation queue metric collector tests (§21 Step 5, Phase P).
 * Uses disposable fixture rows only.
 * Run: DATABASE_URL=<isolated-db-url> npx tsx src/server/ops/metrics/collectors/moderationQueues.test.ts
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";

import { collectModerationQueueMetrics } from "./moderationQueues";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  throw new Error("DATABASE_URL must point at an isolated test database");
}

const marker = randomUUID().slice(0, 8);
const createdUserIds: string[] = [];
const createdPlaceIds: string[] = [];
const createdRevisionIds: string[] = [];
const createdActivityIds: string[] = [];
const createdOfferIds: string[] = [];

async function main() {
  const prisma = new PrismaClient({ datasourceUrl: DATABASE_URL });

  const city = await prisma.city.findFirst({ where: { isActive: true }, select: { id: true } });
  assert.ok(city, "expected a seeded active city in the isolated test DB (run prisma/seed.ts first)");

  async function makeUser(): Promise<string> {
    const user = await prisma.user.create({ data: { email: `mod-metric-${marker}-${randomUUID()}@example.invalid` } });
    createdUserIds.push(user.id);
    return user.id;
  }

  async function makePendingPlace(createdAt: Date): Promise<string> {
    const userId = await makeUser();
    const place = await prisma.place.create({
      data: {
        title: `mod-metric-place-${marker}`,
        shortDesc: "test",
        status: "PENDING",
        createdByUserId: userId,
        cityId: city!.id,
        slug: `mod-metric-place-${marker}-${randomUUID()}`,
        createdAt,
      },
    });
    createdPlaceIds.push(place.id);
    return place.id;
  }

  async function makePendingOffer(createdAt: Date): Promise<void> {
    const userId = await makeUser();
    const place = await prisma.place.create({
      data: {
        title: `mod-metric-place-${marker}`,
        shortDesc: "test",
        status: "PUBLISHED",
        createdByUserId: userId,
        cityId: city!.id,
        slug: `mod-metric-place-${marker}-${randomUUID()}`,
      },
    });
    createdPlaceIds.push(place.id);
    const offer = await prisma.offer.create({
      data: { placeId: place.id, kind: "SERVICE", title: `mod-metric-offer-${marker}`, status: "PENDING", createdAt },
    });
    createdOfferIds.push(offer.id);
  }

  async function cleanup() {
    await prisma.offer.deleteMany({ where: { id: { in: createdOfferIds } } });
    await prisma.placeRevision.deleteMany({ where: { id: { in: createdRevisionIds } } });
    await prisma.activity.deleteMany({ where: { id: { in: createdActivityIds } } });
    await prisma.place.deleteMany({ where: { id: { in: createdPlaceIds } } });
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
  }

  try {
    const now = new Date();

    // Empty queues -> size 0, oldest_age_sec 0 (proven empty, a real fact).
    {
      const result = await collectModerationQueueMetrics({ prisma, now });
      const placeSize = result.find((s) => s.metric === "queue.moderation.size" && s.dimKey === "place");
      const placeAge = result.find((s) => s.metric === "queue.moderation.oldest_age_sec" && s.dimKey === "place");
      assert.equal(placeSize?.value, 0);
      assert.equal(placeAge?.value, 0);
    }

    // All four queue keys present.
    {
      const result = await collectModerationQueueMetrics({ prisma, now });
      const sizeDims = result.filter((s) => s.metric === "queue.moderation.size").map((s) => s.dimKey).sort();
      assert.deepEqual(sizeDims, ["event", "offer", "place", "place_revision"]);
    }

    // Non-empty: correct count and oldest-age-in-seconds using DB-adjacent time.
    {
      const ageMs = 3 * 60 * 60 * 1000; // 3h old
      await makePendingPlace(new Date(now.getTime() - ageMs));
      await makePendingPlace(new Date(now.getTime() - 60_000)); // newer, not the oldest

      const result = await collectModerationQueueMetrics({ prisma, now });
      const placeSize = result.find((s) => s.metric === "queue.moderation.size" && s.dimKey === "place");
      const placeAge = result.find((s) => s.metric === "queue.moderation.oldest_age_sec" && s.dimKey === "place");
      assert.equal(placeSize?.value, 2);
      assert.ok(
        Math.abs((placeAge?.value ?? 0) - ageMs / 1000) < 5,
        `oldest_age_sec must reflect the OLDEST pending item (~${ageMs / 1000}s), got ${placeAge?.value}`,
      );
      await cleanup();
    }

    // dimKey correctness: offer queue independent of place queue.
    {
      await makePendingOffer(new Date(now.getTime() - 10 * 60 * 60 * 1000));
      const result = await collectModerationQueueMetrics({ prisma, now });
      const offerSize = result.find((s) => s.metric === "queue.moderation.size" && s.dimKey === "offer");
      const placeSize = result.find((s) => s.metric === "queue.moderation.size" && s.dimKey === "place");
      assert.equal(offerSize?.value, 1);
      assert.equal(placeSize?.value, 0, "creating an offer also creates its host Place, but that Place is PUBLISHED-ineligible for pending count here since it was never itself set PENDING for the queue check — must not leak into place count");
      await cleanup();
    }

    console.log("moderationQueues.test.ts: OK");
  } finally {
    await cleanup();
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
