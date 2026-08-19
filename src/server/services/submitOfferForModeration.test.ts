/**
 * Self-generated temporary fixtures (created and torn down within this
 * file), per project convention — no committed snapshot or /tmp dependency.
 * Exercises submitOfferForModeration() against the real local dev DB.
 */
import assert from "node:assert/strict";
import prisma from "@/lib/prisma";
import { submitOfferForModeration } from "./moderation.service";

const FIXTURE_TAG = "test-fixture-submit-offer-for-moderation";

async function createFixture() {
  const admin = await prisma.user.findFirstOrThrow({ where: { role: "ADMIN" }, select: { id: true } });
  const owner = await prisma.user.create({
    data: { email: `${FIXTURE_TAG}-owner-${Date.now()}@example.invalid`, role: "USER" },
  });
  const otherUser = await prisma.user.create({
    data: { email: `${FIXTURE_TAG}-other-${Date.now()}@example.invalid`, role: "USER" },
  });
  const business = await prisma.business.create({
    data: { ownerUserId: owner.id, status: "APPROVED", name: FIXTURE_TAG },
  });
  const place = await prisma.place.create({
    data: {
      title: FIXTURE_TAG,
      shortDesc: "fixture",
      status: "PUBLISHED",
      createdByUserId: admin.id,
      ownerBusinessId: business.id,
      locationSource: "MANUAL",
    },
  });
  const offer = await prisma.offer.create({
    data: {
      placeId: place.id,
      kind: "SERVICE",
      title: FIXTURE_TAG,
      status: "DRAFT",
    },
  });
  return { admin, owner, otherUser, business, place, offer };
}

async function destroyFixture(f: Awaited<ReturnType<typeof createFixture>>) {
  await prisma.offer.deleteMany({ where: { id: f.offer.id } });
  await prisma.place.deleteMany({ where: { id: f.place.id } });
  await prisma.business.deleteMany({ where: { id: f.business.id } });
  await prisma.user.deleteMany({ where: { id: { in: [f.owner.id, f.otherUser.id] } } });
}

async function testDraftToPendingSucceeds() {
  const f = await createFixture();
  try {
    const result = await submitOfferForModeration(f.offer.id, { type: "OWNER", userId: f.owner.id });
    assert.equal(result.status, "PENDING");
    assert.equal(result.alreadyPending, false);
    const after = await prisma.offer.findUniqueOrThrow({ where: { id: f.offer.id }, select: { status: true } });
    assert.equal(after.status, "PENDING");
  } finally {
    await destroyFixture(f);
  }
}

async function testPendingRerunIsNoop() {
  const f = await createFixture();
  try {
    await submitOfferForModeration(f.offer.id, { type: "OWNER", userId: f.owner.id });
    const second = await submitOfferForModeration(f.offer.id, { type: "OWNER", userId: f.owner.id });
    assert.equal(second.status, "PENDING");
    assert.equal(second.alreadyPending, true, "second call on an already-PENDING Offer must report alreadyPending, not error");
  } finally {
    await destroyFixture(f);
  }
}

async function testPublishedCannotBeResubmitted() {
  const f = await createFixture();
  try {
    await prisma.offer.update({ where: { id: f.offer.id }, data: { status: "PUBLISHED" } });
    await assert.rejects(
      () => submitOfferForModeration(f.offer.id, { type: "OWNER", userId: f.owner.id }),
      /Cannot submit for moderation from status: PUBLISHED/,
    );
  } finally {
    await destroyFixture(f);
  }
}

async function testWrongOwnerDenied() {
  const f = await createFixture();
  try {
    await assert.rejects(
      () => submitOfferForModeration(f.offer.id, { type: "OWNER", userId: f.otherUser.id }),
      /Not authorized/,
    );
    const after = await prisma.offer.findUniqueOrThrow({ where: { id: f.offer.id }, select: { status: true } });
    assert.equal(after.status, "DRAFT", "a denied submit must not change status");
  } finally {
    await destroyFixture(f);
  }
}

async function testPrivilegedMigrationActorBypassesOwnership() {
  const f = await createFixture();
  try {
    const result = await submitOfferForModeration(f.offer.id, { type: "PRIVILEGED_MIGRATION" });
    assert.equal(result.status, "PENDING");
  } finally {
    await destroyFixture(f);
  }
}

async function testProtectedFieldsAndRelationsUnchanged() {
  const f = await createFixture();
  try {
    await submitOfferForModeration(f.offer.id, { type: "OWNER", userId: f.owner.id });
    const after = await prisma.offer.findUniqueOrThrow({
      where: { id: f.offer.id },
      select: { placeId: true, title: true, slug: true },
    });
    assert.equal(after.placeId, f.place.id);
    assert.equal(after.title, FIXTURE_TAG);
    assert.equal(after.slug, null);

    const place = await prisma.place.findUniqueOrThrow({ where: { id: f.place.id }, select: { ownerBusinessId: true, cityId: true, title: true } });
    assert.equal(place.ownerBusinessId, f.business.id);
    assert.equal(place.title, FIXTURE_TAG);

    const offerCountForPlace = await prisma.offer.count({ where: { placeId: f.place.id } });
    assert.equal(offerCountForPlace, 1, "submitOfferForModeration must never create a new Offer");
  } finally {
    await destroyFixture(f);
  }
}

async function main() {
  await testDraftToPendingSucceeds();
  await testPendingRerunIsNoop();
  await testPublishedCannotBeResubmitted();
  await testWrongOwnerDenied();
  await testPrivilegedMigrationActorBypassesOwnership();
  await testProtectedFieldsAndRelationsUnchanged();
  await prisma.$disconnect();
}

main()
  .then(() => {
    console.log("submitOfferForModeration tests: OK");
  })
  .catch(async (error) => {
    console.error("submitOfferForModeration tests: FAILED", error);
    await prisma.$disconnect();
    process.exitCode = 1;
  });
