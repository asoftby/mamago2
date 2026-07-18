import assert from "node:assert/strict";

import { resolveEventCommitContextWithMatching } from "./resolveEventCommitContextWithMatching";
import type { EventCommitContext, NormalizedEventCandidate } from "../event/types";

function baseCandidate(overrides: Partial<NormalizedEventCandidate> = {}): NormalizedEventCandidate {
  return {
    title: "Kids Fest",
    slug: "kids-fest",
    content: "<p>desc</p>",
    excerpt: "excerpt",
    status: "publish",
    publishedAt: "2026-01-01 00:00:00",
    modifiedAt: "2026-01-02 00:00:00",
    eventDatesRaw: ["2026-08-15 10:00:00"],
    scheduleDraft: { mode: "ONE_TIME", dates: ["2026-08-15"] },
    venueNameRaw: "Central Park",
    locationRaw: "Minsk, Central Park",
    addressEventPlaceRaw: "ul. Central, 1",
    cityRaw: "Minsk",
    priceRaw: null,
    ticketUrlRaw: null,
    externalEventId: null,
    externalLastUpdatedRaw: null,
    trailerUrlRaw: null,
    seo: { title: null, focusKeyword: null },
    sourceTerms: [],
    rawMeta: {},
    ...overrides,
  };
}

function baseContext(overrides: Partial<EventCommitContext> = {}): EventCommitContext {
  return {
    ownerUserId: "user-1",
    ...overrides,
  };
}

function createFakePrisma(overrides: Record<string, unknown> = {}) {
  return ({
    city: {
      findFirst: async ({ where }: any) =>
        where?.slug === "minsk" ? { id: "city-minsk" } : null,
      findMany: async () => [{ id: "city-minsk", slug: "minsk", nameRu: "Минск" }],
    },
    eventCategory: {
      findMany: async () => [{ id: "cat-1", nameRu: "Кино" }],
    },
    place: {
      findMany: async () => [],
    },
    migrationLineage: {
      findFirst: async () => null,
    },
    ...overrides,
  }) as any;
}

async function testContextOverrideWins() {
  const prisma = createFakePrisma();
  const result = await resolveEventCommitContextWithMatching({
    sourceRecordKey: "wordpress-db:events:401",
    baseContext: baseContext({ cityId: "city-override", placeId: "place-override", eventCategoryId: "cat-override" }),
    candidate: baseCandidate(),
    prisma,
  });
  assert.equal(result.context.cityId, "city-override");
  assert.equal(result.context.placeId, "place-override");
  assert.equal(result.context.eventCategoryId, "cat-override");
}

async function testCityFromRawMinsk() {
  const prisma = createFakePrisma();
  const result = await resolveEventCommitContextWithMatching({
    sourceRecordKey: "wordpress-db:events:401",
    baseContext: baseContext({ cityId: null }),
    candidate: baseCandidate({ cityRaw: "Минск" }),
    prisma,
  });
  assert.equal(result.context.cityId, "city-minsk");
  assert.ok(result.warnings.some((w) => w.code === "EVENT_CITY_FALLBACK_USED"));
}

async function testCategoryExactMatchByNameRu() {
  const prisma = createFakePrisma({
    eventCategory: {
      findMany: async () => [{ id: "cat-1", nameRu: "Festival" }],
    } as any,
  });
  const result = await resolveEventCommitContextWithMatching({
    sourceRecordKey: "wordpress-db:events:401",
    baseContext: baseContext({ eventCategoryId: null }),
    candidate: baseCandidate({
      sourceTerms: [{ termId: 1, taxonomy: "events-category", name: "Festival", slug: "festival", normalizedName: "festival" }],
    }),
    prisma,
  });
  assert.equal(result.context.eventCategoryId, "cat-1");
}

async function testPlaceLineageMatch() {
  const prisma = createFakePrisma({
    migrationLineage: {
      findFirst: async ({ where }: any) =>
        where?.sourceRecordKey === "wordpress-db:places:301" ? { targetId: "place-1" } : null,
    } as any,
  });
  const result = await resolveEventCommitContextWithMatching({
    sourceRecordKey: "wordpress-db:events:401",
    baseContext: baseContext({ placeId: null }),
    candidate: baseCandidate({ venuePlacePostIdRaw: 301 }),
    prisma,
  });
  assert.equal(result.context.placeId, "place-1");
}

async function testPlaceUnmatchedPreservesRawWarning() {
  const prisma = createFakePrisma({
    place: { findMany: async () => [] } as any,
  });
  const result = await resolveEventCommitContextWithMatching({
    sourceRecordKey: "wordpress-db:events:401",
    baseContext: baseContext({ placeId: null }),
    candidate: baseCandidate({ venuePlacePostIdRaw: null }),
    prisma,
  });
  assert.ok(result.warnings.some((w) => w.code === "EVENT_RAW_LOCATION_PRESERVED"));
}

async function testOrganizerLeftNullWarnsForReview() {
  const prisma = createFakePrisma();
  const result = await resolveEventCommitContextWithMatching({
    sourceRecordKey: "wordpress-db:events:401",
    baseContext: baseContext(),
    candidate: baseCandidate(),
    prisma,
  });
  assert.equal(result.context.organizerId, undefined, "no matcher exists — organizerId must never be auto-assigned");
  assert.ok(result.warnings.some((w) => w.code === "EVENT_ORGANIZER_REQUIRES_REVIEW"));
}

async function testOrganizerFromContextSuppressesWarning() {
  const prisma = createFakePrisma();
  const result = await resolveEventCommitContextWithMatching({
    sourceRecordKey: "wordpress-db:events:401",
    baseContext: baseContext({ organizerId: "organizer-1" }),
    candidate: baseCandidate(),
    prisma,
  });
  assert.equal(result.context.organizerId, "organizer-1");
  assert.ok(!result.warnings.some((w) => w.code === "EVENT_ORGANIZER_REQUIRES_REVIEW"));
}

async function main() {
  await testContextOverrideWins();
  await testCityFromRawMinsk();
  await testCategoryExactMatchByNameRu();
  await testPlaceLineageMatch();
  await testPlaceUnmatchedPreservesRawWarning();
  await testOrganizerLeftNullWarnsForReview();
  await testOrganizerFromContextSuppressesWarning();
}

main()
  .then(() => console.log("resolveEventCommitContextWithMatching tests: OK"))
  .catch((e) => {
    console.error("resolveEventCommitContextWithMatching tests: FAILED", e);
    process.exitCode = 1;
  });

