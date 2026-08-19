/**
 * moderation_queue_stale detector tests (§21 Step 4, Phase E).
 * Uses disposable fixture rows only — never touches real DEV moderation
 * data. Run: DATABASE_URL=<isolated-db-url> npx tsx src/server/ops/detectors/moderationQueueStale.test.ts
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";

import { reconcileDetectorSignals } from "../reconciliation";
import type { DetectorContext } from "../types";
import {
  evaluateModerationQueueStale,
  moderationQueueStaleFingerprint,
  probeModerationQueueStale,
} from "./moderationQueueStale";

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
  const ctx: DetectorContext = { prisma, fetch, workerStartedAt: new Date() };

  async function makeUser(): Promise<string> {
    const user = await prisma.user.create({ data: { email: `mod-test-${marker}-${randomUUID()}@example.invalid` } });
    createdUserIds.push(user.id);
    return user.id;
  }

  const city = await prisma.city.findFirst({ where: { isActive: true }, select: { id: true } });
  assert.ok(city, "expected a seeded active city in the isolated test DB (run prisma/seed.ts first)");

  async function makePendingPlace(createdAt: Date): Promise<string> {
    const userId = await makeUser();
    const place = await prisma.place.create({
      data: {
        title: `mod-test-place-${marker}`,
        shortDesc: "test",
        status: "PENDING",
        createdByUserId: userId,
        cityId: city!.id,
        slug: `mod-test-place-${marker}-${randomUUID()}`,
        createdAt,
      },
    });
    createdPlaceIds.push(place.id);
    return place.id;
  }

  async function makePendingRevision(submittedAt: Date | null): Promise<string> {
    const placeId = await makePendingPlace(new Date());
    const revision = await prisma.placeRevision.create({
      data: { placeId, status: "PENDING", submittedAt: submittedAt ?? undefined },
    });
    createdRevisionIds.push(revision.id);
    return revision.id;
  }

  async function makePendingEvent(createdAt: Date): Promise<string> {
    const userId = await makeUser();
    const activity = await prisma.activity.create({
      data: {
        ownerUserId: userId,
        title: `mod-test-event-${marker}`,
        shortDesc: "test",
        type: "EVENT",
        scheduleMode: "ONE_TIME",
        status: "PENDING",
        createdAt,
      },
    });
    createdActivityIds.push(activity.id);
    return activity.id;
  }

  async function makePendingOffer(createdAt: Date): Promise<string> {
    const placeId = await makePendingPlace(new Date());
    const offer = await prisma.offer.create({
      data: { placeId, kind: "SERVICE", title: `mod-test-offer-${marker}`, status: "PENDING", createdAt },
    });
    createdOfferIds.push(offer.id);
    return offer.id;
  }

  async function cleanupAll() {
    await prisma.operationalSignal.deleteMany({ where: { detector: "moderation_queue_stale" } });
    await prisma.offer.deleteMany({ where: { id: { in: createdOfferIds } } });
    await prisma.placeRevision.deleteMany({ where: { id: { in: createdRevisionIds } } });
    await prisma.activity.deleteMany({ where: { id: { in: createdActivityIds } } });
    await prisma.place.deleteMany({ where: { id: { in: createdPlaceIds } } });
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
  }

  try {
    // 1. Empty queue -> no signal.
    {
      const probe = await probeModerationQueueStale(ctx);
      const result = evaluateModerationQueueStale(probe);
      assert.deepEqual(result.signals, [], "no fixtures created yet -> every queue must be empty");
    }

    // 2. Oldest age <48h -> no signal.
    {
      await makePendingPlace(new Date(Date.now() - 10 * 60 * 60 * 1000)); // 10h old
      const probe = await probeModerationQueueStale(ctx);
      const result = evaluateModerationQueueStale(probe);
      assert.equal(
        result.signals.find((s) => s.fingerprint === moderationQueueStaleFingerprint("place")),
        undefined,
      );
      await cleanupAll();
    }

    // 3. Exactly 48h -> no signal (strictly greater than).
    {
      const probe0 = await probeModerationQueueStale(ctx);
      const now = probe0.now;
      await makePendingPlace(new Date(now.getTime() - 48 * 60 * 60 * 1000));
      const probe = await probeModerationQueueStale(ctx);
      // Use the same `now` captured just before creation to keep the boundary exact.
      const result = evaluateModerationQueueStale({ now, queues: probe.queues });
      assert.equal(
        result.signals.find((s) => s.fingerprint === moderationQueueStaleFingerprint("place")),
        undefined,
        "exactly 48h must NOT be a warning",
      );
      await cleanupAll();
    }

    // 4. >48h -> WARNING.
    {
      const probe0 = await probeModerationQueueStale(ctx);
      const now = probe0.now;
      await makePendingPlace(new Date(now.getTime() - 48 * 60 * 60 * 1000 - 1000));
      const probe = await probeModerationQueueStale(ctx);
      const result = evaluateModerationQueueStale({ now, queues: probe.queues });
      const signal = result.signals.find((s) => s.fingerprint === moderationQueueStaleFingerprint("place"));
      assert.ok(signal, "just over 48h must be a warning");
      assert.equal(signal!.severity, "WARNING");
      await cleanupAll();
    }

    // 5. Multiple queues evaluated independently.
    {
      const staleAt = new Date(Date.now() - 50 * 60 * 60 * 1000);
      const freshAt = new Date();
      await makePendingPlace(staleAt);
      await makePendingRevision(staleAt);
      await makePendingEvent(freshAt);
      await makePendingOffer(staleAt);

      const probe = await probeModerationQueueStale(ctx);
      const result = evaluateModerationQueueStale(probe);
      const fingerprints = result.signals.map((s) => s.fingerprint).sort();
      assert.deepEqual(
        fingerprints,
        [
          moderationQueueStaleFingerprint("offer"),
          moderationQueueStaleFingerprint("place"),
          moderationQueueStaleFingerprint("place_revision"),
        ].sort(),
        "place/place_revision/offer stale, event fresh -> exactly those three fingerprints",
      );
      await cleanupAll();
    }

    // 6. Stale queue fingerprint stable across repeated evaluations.
    {
      await makePendingOffer(new Date(Date.now() - 60 * 60 * 60 * 1000));
      const probeA = await probeModerationQueueStale(ctx);
      const fpA = evaluateModerationQueueStale(probeA).signals[0].fingerprint;
      const probeB = await probeModerationQueueStale(ctx);
      const fpB = evaluateModerationQueueStale(probeB).signals[0].fingerprint;
      assert.equal(fpA, fpB);
      await cleanupAll();
    }

    // 8. No NodeRegistry node exists for this detector.
    {
      const { moderationQueueStaleDetector } = await import("./moderationQueueStale");
      assert.deepEqual(moderationQueueStaleDetector.nodes, []);
    }

    console.log("moderationQueueStale.test.ts (probe/evaluate): OK");

    // 7. Recovered queue eventually resolves via shared reconciliation.
    {
      const DETECTOR = "moderation_queue_stale";
      await makePendingEvent(new Date(Date.now() - 60 * 60 * 60 * 1000));

      const probe1 = await probeModerationQueueStale(ctx);
      const staleSignals = evaluateModerationQueueStale(probe1).signals;
      assert.ok(staleSignals.some((s) => s.fingerprint === moderationQueueStaleFingerprint("event")));

      await reconcileDetectorSignals(prisma, DETECTOR, staleSignals); // PENDING
      await reconcileDetectorSignals(prisma, DETECTOR, staleSignals); // OPEN
      let live = await prisma.operationalSignal.findFirst({
        where: { detector: DETECTOR, fingerprint: moderationQueueStaleFingerprint("event"), resolvedAt: null },
      });
      assert.equal(live?.status, "OPEN");

      // Queue recovers (e.g. the event got moderated) -> 3 consecutive misses.
      await cleanupAll();
      // cleanupAll wipes the OperationalSignal rows too — redo the OPEN
      // signal setup without the queue item, then verify recovery cleanly.
    }
    {
      const DETECTOR = "moderation_queue_stale";
      const eventId = await makePendingEvent(new Date(Date.now() - 60 * 60 * 60 * 1000));
      const probe1 = await probeModerationQueueStale(ctx);
      const staleSignals = evaluateModerationQueueStale(probe1).signals;
      await reconcileDetectorSignals(prisma, DETECTOR, staleSignals);
      await reconcileDetectorSignals(prisma, DETECTOR, staleSignals);

      // Moderate the event (leaves PENDING state) so the queue is empty again.
      await prisma.activity.update({ where: { id: eventId }, data: { status: "PUBLISHED" } });

      const probe2 = await probeModerationQueueStale(ctx);
      const recoveredSignals = evaluateModerationQueueStale(probe2).signals;
      assert.equal(
        recoveredSignals.find((s) => s.fingerprint === moderationQueueStaleFingerprint("event")),
        undefined,
      );

      await reconcileDetectorSignals(prisma, DETECTOR, recoveredSignals);
      await reconcileDetectorSignals(prisma, DETECTOR, recoveredSignals);
      const finalCounts = await reconcileDetectorSignals(prisma, DETECTOR, recoveredSignals);
      assert.equal(finalCounts.signalsResolved, 1);

      const live = await prisma.operationalSignal.findFirst({
        where: { detector: DETECTOR, fingerprint: moderationQueueStaleFingerprint("event"), resolvedAt: null },
      });
      assert.equal(live, null, "must auto-resolve after 3 consecutive misses");
    }

    console.log("moderationQueueStale.test.ts (reconciliation recovery): OK");
  } finally {
    await cleanupAll();
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
