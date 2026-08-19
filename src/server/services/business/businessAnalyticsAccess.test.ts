/**
 * P0 test for Business Analytics ownership enforcement (Task 3 Business
 * Analytics MVP). `businessOwnsPublication()` is the gate the new
 * `/api/business/analytics/publications/[entityType]/[entityId]` route
 * calls before running any UserEvent aggregation — a foreign business's
 * Event/Offer must never be readable through it.
 *
 * Self-generated temporary fixtures (created and torn down within this
 * file), per project convention (see submitOfferForModeration.test.ts) —
 * exercises the real exported businessOwnsPublication() against the local
 * dev DB: two separate businesses, each with their own Event and Offer.
 *
 * Запуск: set -a; source .env; set +a; npx tsx src/server/services/business/businessAnalyticsAccess.test.ts
 */
import assert from "node:assert/strict";
import prisma from "@/lib/prisma";
import { businessOwnsPublication } from "./businessAnalyticsAccess";

const FIXTURE_TAG = "test-fixture-business-analytics-access";

async function createFixture() {
  const admin = await prisma.user.findFirstOrThrow({
    where: { role: "ADMIN" },
    select: { id: true },
  });

  const [ownerA, ownerB] = await Promise.all([
    prisma.user.create({
      data: { email: `${FIXTURE_TAG}-a-${Date.now()}@example.invalid`, role: "USER" },
    }),
    prisma.user.create({
      data: { email: `${FIXTURE_TAG}-b-${Date.now()}@example.invalid`, role: "USER" },
    }),
  ]);

  const [businessA, businessB] = await Promise.all([
    prisma.business.create({
      data: { ownerUserId: ownerA.id, status: "APPROVED", name: `${FIXTURE_TAG}-a` },
    }),
    prisma.business.create({
      data: { ownerUserId: ownerB.id, status: "APPROVED", name: `${FIXTURE_TAG}-b` },
    }),
  ]);

  const [placeA, placeB] = await Promise.all([
    prisma.place.create({
      data: {
        title: `${FIXTURE_TAG}-place-a`,
        shortDesc: "fixture",
        status: "PUBLISHED",
        createdByUserId: admin.id,
        ownerBusinessId: businessA.id,
        locationSource: "MANUAL",
      },
    }),
    prisma.place.create({
      data: {
        title: `${FIXTURE_TAG}-place-b`,
        shortDesc: "fixture",
        status: "PUBLISHED",
        createdByUserId: admin.id,
        ownerBusinessId: businessB.id,
        locationSource: "MANUAL",
      },
    }),
  ]);

  const [eventA, eventB] = await Promise.all([
    prisma.activity.create({
      data: {
        ownerUserId: ownerA.id,
        businessId: businessA.id,
        title: `${FIXTURE_TAG}-event-a`,
        shortDesc: "fixture",
        type: "EVENT",
        scheduleMode: "ONE_TIME",
      },
    }),
    prisma.activity.create({
      data: {
        ownerUserId: ownerB.id,
        businessId: businessB.id,
        title: `${FIXTURE_TAG}-event-b`,
        shortDesc: "fixture",
        type: "EVENT",
        scheduleMode: "ONE_TIME",
      },
    }),
  ]);

  const [offerA, offerB] = await Promise.all([
    prisma.offer.create({
      data: { placeId: placeA.id, kind: "SERVICE", title: `${FIXTURE_TAG}-offer-a`, status: "DRAFT" },
    }),
    prisma.offer.create({
      data: { placeId: placeB.id, kind: "SERVICE", title: `${FIXTURE_TAG}-offer-b`, status: "DRAFT" },
    }),
  ]);

  return { admin, ownerA, ownerB, businessA, businessB, placeA, placeB, eventA, eventB, offerA, offerB };
}

async function destroyFixture(f: Awaited<ReturnType<typeof createFixture>>) {
  await prisma.offer.deleteMany({ where: { id: { in: [f.offerA.id, f.offerB.id] } } });
  await prisma.activity.deleteMany({ where: { id: { in: [f.eventA.id, f.eventB.id] } } });
  await prisma.place.deleteMany({ where: { id: { in: [f.placeA.id, f.placeB.id] } } });
  await prisma.business.deleteMany({ where: { id: { in: [f.businessA.id, f.businessB.id] } } });
  await prisma.user.deleteMany({ where: { id: { in: [f.ownerA.id, f.ownerB.id] } } });
}

async function testOwnEventIsAllowed(f: Awaited<ReturnType<typeof createFixture>>) {
  const owns = await businessOwnsPublication({
    userId: f.ownerA.id,
    businessId: f.businessA.id,
    entityType: "EVENT",
    entityId: f.eventA.id,
  });
  assert.equal(owns, true, "business A must be able to access its own Event");
}

async function testOwnOfferIsAllowed(f: Awaited<ReturnType<typeof createFixture>>) {
  const owns = await businessOwnsPublication({
    userId: f.ownerA.id,
    businessId: f.businessA.id,
    entityType: "OFFER",
    entityId: f.offerA.id,
  });
  assert.equal(owns, true, "business A must be able to access its own Offer");
}

async function testForeignEventIsRejected(f: Awaited<ReturnType<typeof createFixture>>) {
  const owns = await businessOwnsPublication({
    userId: f.ownerA.id,
    businessId: f.businessA.id,
    entityType: "EVENT",
    entityId: f.eventB.id,
  });
  assert.equal(owns, false, "business A must NOT be able to access business B's Event");
}

async function testForeignOfferIsRejected(f: Awaited<ReturnType<typeof createFixture>>) {
  const owns = await businessOwnsPublication({
    userId: f.ownerA.id,
    businessId: f.businessA.id,
    entityType: "OFFER",
    entityId: f.offerB.id,
  });
  assert.equal(owns, false, "business A must NOT be able to access business B's Offer");
}

async function testOwnPlaceIsAllowedForeignPlaceRejected(f: Awaited<ReturnType<typeof createFixture>>) {
  const ownsOwn = await businessOwnsPublication({
    userId: f.ownerA.id,
    businessId: f.businessA.id,
    entityType: "PLACE",
    entityId: f.placeA.id,
  });
  assert.equal(ownsOwn, true, "business A must be able to access its own Place");

  const ownsForeign = await businessOwnsPublication({
    userId: f.ownerA.id,
    businessId: f.businessA.id,
    entityType: "PLACE",
    entityId: f.placeB.id,
  });
  assert.equal(ownsForeign, false, "business A must NOT be able to access business B's Place");
}

async function testNonexistentEntityIsRejected(f: Awaited<ReturnType<typeof createFixture>>) {
  const owns = await businessOwnsPublication({
    userId: f.ownerA.id,
    businessId: f.businessA.id,
    entityType: "EVENT",
    entityId: "does-not-exist-fixture-id",
  });
  assert.equal(owns, false, "a nonexistent entityId must be rejected, not silently allowed");
}

async function testArticleAndRouteAreNeverBusinessOwned(f: Awaited<ReturnType<typeof createFixture>>) {
  // Article/Route are not business-owned publication types in this MVP —
  // must fail closed regardless of entityId.
  const ownsArticle = await businessOwnsPublication({
    userId: f.ownerA.id,
    businessId: f.businessA.id,
    entityType: "ARTICLE",
    entityId: f.eventA.id, // even a real id of a different type must not leak access
  });
  assert.equal(ownsArticle, false);

  const ownsRoute = await businessOwnsPublication({
    userId: f.ownerA.id,
    businessId: f.businessA.id,
    entityType: "ROUTE",
    entityId: f.eventA.id,
  });
  assert.equal(ownsRoute, false);
}

async function main() {
  const f = await createFixture();
  try {
    await testOwnEventIsAllowed(f);
    await testOwnOfferIsAllowed(f);
    await testForeignEventIsRejected(f);
    await testForeignOfferIsRejected(f);
    await testOwnPlaceIsAllowedForeignPlaceRejected(f);
    await testNonexistentEntityIsRejected(f);
    await testArticleAndRouteAreNeverBusinessOwned(f);
  } finally {
    await destroyFixture(f);
  }
  console.log("businessAnalyticsAccess ownership tests: OK");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
