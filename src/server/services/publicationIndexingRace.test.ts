/**
 * Regression tests for EVENT_SEARCH_INDEX_PUBLICATION_RACE.
 *
 * Self-generated temporary fixtures (created and torn down within this
 * file), per project convention — no committed snapshot or /tmp dependency.
 * Exercises the real approveActivity()/approvePlace()/approveOffer()
 * against the real local dev DB, asserting the final SearchDocument always
 * reflects the final, slug-based published state — never an intermediate
 * (published-but-no-slug) one, and never a duplicate.
 */
import assert from "node:assert/strict";
import prisma, { prismaBase } from "@/lib/prisma";
import { approveActivity, approvePlace, approveOffer } from "./moderation.service";

const TAG = "test-fixture-publication-indexing-race";

async function getAdminId(): Promise<string> {
  const admin = await prismaBase.user.findFirstOrThrow({ where: { role: "ADMIN" }, select: { id: true } });
  return admin.id;
}

async function getPublicCity() {
  return prismaBase.city.findFirstOrThrow({
    where: { isActive: true },
    orderBy: { slug: "asc" },
    select: { id: true, slug: true, name: true },
  });
}

// ---------------------------------------------------------------------------
// Activity (Event)
// ---------------------------------------------------------------------------

async function createActivityFixture() {
  const adminId = await getAdminId();
  const city = await getPublicCity();
  const activity = await prismaBase.activity.create({
    data: {
      title: TAG,
      shortDesc: TAG,
      status: "PENDING",
      type: "EVENT",
      scheduleMode: "ONE_TIME",
      ownerUserId: adminId,
      cityId: city.id,
    },
  });
  return { activity, adminId, city };
}

async function destroyActivityFixture(activityId: string) {
  await prismaBase.searchDocument.deleteMany({ where: { entityType: "activity", entityId: activityId } });
  await prismaBase.moderationLog.deleteMany({ where: { entityType: "ACTIVITY", entityId: activityId } });
  await prismaBase.activity.deleteMany({ where: { id: activityId } });
}

async function testActivityApprovalIndexesFinalSlugBasedState() {
  const { activity, adminId, city } = await createActivityFixture();
  try {
    await approveActivity(activity.id, adminId);

    const after = await prismaBase.activity.findUniqueOrThrow({ where: { id: activity.id }, select: { status: true, slug: true } });
    assert.equal(after.status, "PUBLISHED");
    assert.ok(after.slug, "activity should have been assigned a slug on publish");

    const doc = await prismaBase.searchDocument.findUnique({
      where: { entityType_entityId: { entityType: "activity", entityId: activity.id } },
    });
    assert.ok(doc, "search document must exist after approval completes");
    assert.equal(doc!.isPublished, true);
    assert.equal(doc!.title, TAG);
    assert.ok(doc!.urlPath.startsWith(`/${city.slug}/events/`), "urlPath must use the final city");
    assert.ok(!doc!.urlPath.includes(activity.id), "urlPath must never be id-based once a slug exists");
    assert.ok(doc!.urlPath.includes(after.slug!), "urlPath must contain the final slug");
  } finally {
    await destroyActivityFixture(activity.id);
  }
}

async function testActivityApprovalIsIdempotentNoDuplicateDocument() {
  const { activity, adminId } = await createActivityFixture();
  try {
    await approveActivity(activity.id, adminId);
    // A second explicit reindex (simulating a resume/rerun) must not create
    // a second row — SearchDocument is keyed unique on (entityType, entityId).
    const { searchIndexer } = await import("@/lib/prisma");
    await searchIndexer.upsertActivity(activity.id);

    const docs = await prismaBase.searchDocument.findMany({ where: { entityType: "activity", entityId: activity.id } });
    assert.equal(docs.length, 1, "must never produce duplicate search documents");
  } finally {
    await destroyActivityFixture(activity.id);
  }
}

// ---------------------------------------------------------------------------
// Place
// ---------------------------------------------------------------------------

async function createPlaceFixture() {
  const adminId = await getAdminId();
  const city = await getPublicCity();
  const place = await prismaBase.place.create({
    data: {
      title: TAG,
      shortDesc: TAG,
      status: "PENDING",
      createdByUserId: adminId,
      cityId: city.id,
      locationSource: "MANUAL",
    },
  });
  return { place, adminId, city };
}

async function destroyPlaceFixture(placeId: string) {
  await prismaBase.searchDocument.deleteMany({ where: { entityType: "place", entityId: placeId } });
  await prismaBase.moderationLog.deleteMany({ where: { entityType: "PLACE", entityId: placeId } });
  await prismaBase.place.deleteMany({ where: { id: placeId } });
}

async function testPlaceApprovalIndexesFinalSlugBasedState() {
  const { place, adminId } = await createPlaceFixture();
  try {
    await approvePlace(place.id, adminId);

    const after = await prismaBase.place.findUniqueOrThrow({ where: { id: place.id }, select: { status: true, slug: true } });
    assert.equal(after.status, "PUBLISHED");
    assert.ok(after.slug, "place should have been assigned a slug on publish");

    const doc = await prismaBase.searchDocument.findUnique({
      where: { entityType_entityId: { entityType: "place", entityId: place.id } },
    });
    assert.ok(doc, "search document must exist after approval completes");
    assert.equal(doc!.isPublished, true);
    assert.equal(doc!.title, TAG);
    assert.ok(!doc!.urlPath.includes(place.id), "urlPath must never be id-based once a slug exists");
    assert.ok(doc!.urlPath.includes(after.slug!), "urlPath must contain the final slug");
  } finally {
    await destroyPlaceFixture(place.id);
  }
}

// ---------------------------------------------------------------------------
// Offer
// ---------------------------------------------------------------------------

async function createOfferFixture() {
  const adminId = await getAdminId();
  const city = await getPublicCity();
  const owner = await prismaBase.user.create({
    data: { email: `${TAG}-owner-${Date.now()}@example.invalid`, role: "USER" },
  });
  const business = await prismaBase.business.create({ data: { ownerUserId: owner.id, status: "APPROVED", name: TAG } });
  const place = await prismaBase.place.create({
    data: {
      title: TAG,
      shortDesc: TAG,
      status: "PUBLISHED",
      createdByUserId: adminId,
      cityId: city.id,
      ownerBusinessId: business.id,
      locationSource: "MANUAL",
    },
  });
  const offer = await prismaBase.offer.create({
    data: { placeId: place.id, kind: "SERVICE", title: TAG, status: "PENDING" },
  });
  return { offer, place, business, owner, adminId, city };
}

async function destroyOfferFixture(f: Awaited<ReturnType<typeof createOfferFixture>>) {
  await prismaBase.searchDocument.deleteMany({ where: { entityType: "offer", entityId: f.offer.id } });
  await prismaBase.offer.deleteMany({ where: { id: f.offer.id } });
  await prismaBase.place.deleteMany({ where: { id: f.place.id } });
  await prismaBase.business.deleteMany({ where: { id: f.business.id } });
  await prismaBase.user.deleteMany({ where: { id: f.owner.id } });
}

async function testOfferApprovalIndexesFinalSlugBasedStateAndAwaitsCanonicalSync() {
  const f = await createOfferFixture();
  try {
    await approveOffer(f.offer.id, f.adminId);

    const after = await prismaBase.offer.findUniqueOrThrow({ where: { id: f.offer.id }, select: { status: true, slug: true, seoCanonicalUrl: true } });
    assert.equal(after.status, "PUBLISHED");
    assert.ok(after.slug, "offer should have been assigned a slug on publish");
    assert.ok(after.seoCanonicalUrl, "canonical must be synced and awaited before approveOffer returns, not fire-and-forget");

    const doc = await prismaBase.searchDocument.findUnique({
      where: { entityType_entityId: { entityType: "offer", entityId: f.offer.id } },
    });
    assert.ok(doc, "search document must exist after approval completes");
    assert.equal(doc!.isPublished, true);
    assert.equal(doc!.title, TAG);
    assert.ok(doc!.searchText.includes(f.city.name), "document must use the final Place city");
    assert.ok(!doc!.urlPath.includes(f.offer.id), "urlPath must never be id-based once a slug exists");
    assert.ok(doc!.urlPath.includes(after.slug!), "urlPath must contain the final slug");
  } finally {
    await destroyOfferFixture(f);
  }
}

async function main() {
  await testActivityApprovalIndexesFinalSlugBasedState();
  await testActivityApprovalIsIdempotentNoDuplicateDocument();
  await testPlaceApprovalIndexesFinalSlugBasedState();
  await testOfferApprovalIndexesFinalSlugBasedStateAndAwaitsCanonicalSync();
  await prisma.$disconnect();
}

main()
  .then(() => {
    console.log("publicationIndexingRace tests: OK");
  })
  .catch(async (error) => {
    console.error("publicationIndexingRace tests: FAILED", error);
    await prisma.$disconnect();
    process.exitCode = 1;
  });
