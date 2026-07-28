import assert from "node:assert/strict";

import { OfferCommitWriter } from "./OfferCommitWriter";
import type { OfferCommitWriterPrismaClient } from "./OfferCommitWriter";
import type { OfferCreateDraft } from "./types";

function draftFixture(overrides: Partial<OfferCreateDraft> = {}): OfferCreateDraft {
  return {
    placeId: "place-1",
    createRequestId: "wordpress-db:hb-programs:1",
    kind: "SERVICE",
    productType: null,
    title: "Cool Offer",
    description: "A cool offer for kids",
    status: "DRAFT",
    priceFrom: 100,
    priceText: "от 100 руб.",
    ageMinMonths: null,
    ageMaxMonths: null,
    contactPhone: null,
    contactWebsite: null,
    seoTitle: null,
    seoDescription: null,
    seoCanonicalUrl: null,
    seoRobots: null,
    seoOgTitle: null,
    seoOgDescription: null,
    sourceMediaAttachmentIds: [],
    ownership: { ownerUserId: "user-1", businessId: null, cityId: "city-1" },
    ...overrides,
  };
}

function createFakeClient(): { client: OfferCommitWriterPrismaClient; createCalls: Array<{ data: Record<string, unknown> }> } {
  const createCalls: Array<{ data: Record<string, unknown> }> = [];
  const client = {
    offer: {
      create: (async ({ data }: { data: Record<string, unknown> }) => {
        createCalls.push({ data });
        return { id: "offer-1", ...data };
      }) as unknown as OfferCommitWriterPrismaClient["offer"]["create"],
      updateMany: (async () => ({ count: 1 })) as unknown as OfferCommitWriterPrismaClient["offer"]["updateMany"],
    },
  } as OfferCommitWriterPrismaClient;
  return { client, createCalls };
}

// ---------------------------------------------------------------------------
// Regression: draft.ownership.cityId is required and validated by
// buildOfferCreateDraft (MISSING_CITY blocks otherwise) — the writer must
// actually persist it, or every migrated Offer ends up with cityId: null
// despite always having a resolved, evidence-backed city.
// ---------------------------------------------------------------------------

async function testCreateWritesCityIdFromOwnership() {
  const { client, createCalls } = createFakeClient();
  const writer = new OfferCommitWriter(client);
  const result = await writer.createOfferFromDraft(draftFixture({ ownership: { ownerUserId: "user-1", businessId: null, cityId: "city-resolved" } }));

  assert.equal(result.ok, true);
  assert.equal(createCalls.length, 1);
  assert.equal(createCalls[0].data.cityId, "city-resolved", "Offer.cityId must be set from draft.ownership.cityId on create");
}

async function testHappyPathCallsCreateOnce() {
  const { client, createCalls } = createFakeClient();
  const writer = new OfferCommitWriter(client);
  const result = await writer.createOfferFromDraft(draftFixture());

  assert.deepEqual(result, { ok: true, offerId: "offer-1" });
  assert.equal(createCalls.length, 1);
  assert.equal(createCalls[0].data.placeId, "place-1");
  assert.equal(createCalls[0].data.status, "DRAFT");
}

async function testCreateRejectsNonDraftStatus() {
  const { client } = createFakeClient();
  const writer = new OfferCommitWriter(client);
  const badDraft = { ...draftFixture(), status: "PUBLISHED" } as unknown as OfferCreateDraft;
  await assert.rejects(() => writer.createOfferFromDraft(badDraft));
}

async function main() {
  await testHappyPathCallsCreateOnce();
  await testCreateWritesCityIdFromOwnership();
  await testCreateRejectsNonDraftStatus();
}

main()
  .then(() => {
    console.log("OfferCommitWriter tests: OK");
  })
  .catch((error) => {
    console.error("OfferCommitWriter tests: FAILED", error);
    process.exitCode = 1;
  });
