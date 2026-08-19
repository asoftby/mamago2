import assert from "node:assert/strict";

import type { NormalizedPlaceCandidate } from "../commit/place/types";
import { PlaceScalarLinker } from "./PlaceScalarLinker";
import type { LinkPlaceScalarsInput, PlaceCityLookupLike, PlaceScalarLinkerPrismaClient } from "./types";

function candidateFixture(overrides: Partial<NormalizedPlaceCandidate> = {}): NormalizedPlaceCandidate {
  return {
    title: "Cool Place",
    slug: "cool-place",
    content: "<p>A cool place for kids.</p>",
    excerpt: "A cool place excerpt",
    status: "publish",
    publishedAt: "2026-01-01 00:00:00",
    modifiedAt: "2026-01-02 00:00:00",
    shortDescription: "A great place for kids",
    phone: null,
    phoneE164: null,
    openingHours: null,
    email: null,
    workHoursRaw: null,
    locationRaw: null,
    addressText: null,
    cityRaw: null,
    coordinates: null,
    media: { thumbnailAttachmentId: null, galleryAttachmentIds: [] },
    seo: { title: null, focusKeyword: null },
    sourceTerms: [],
    rawMeta: {},
    ...overrides,
  };
}

function inputFixture(overrides: Partial<LinkPlaceScalarsInput> = {}): LinkPlaceScalarsInput {
  return {
    placeId: "place-1",
    candidate: candidateFixture(),
    ...overrides,
  };
}

function createFakePrisma() {
  const updateCalls: Array<{ where: { id: string }; data: Record<string, unknown> }> = [];
  const prisma: PlaceScalarLinkerPrismaClient = {
    place: {
      update: (async (args: unknown) => {
        const call = args as { where: { id: string }; data: Record<string, unknown> };
        updateCalls.push(call);
        return { id: call.where.id, ...call.data };
      }) as unknown as PlaceScalarLinkerPrismaClient["place"]["update"],
    },
  };
  return { prisma, updateCalls };
}

function createFakeCityLookup(options: { result?: string | null } = {}) {
  const calls: string[] = [];
  const cityLookup: PlaceCityLookupLike = {
    findCityIdByName: async (name) => {
      calls.push(name);
      return options.result ?? null;
    },
  };
  return { cityLookup, calls };
}

const FORBIDDEN_FIELDS = [
  "openingHoursId",
  "formattedAddr",
  "displayAddress",
  "locationName",
  "directionsNote",
  "email",
  "website",
  "phone2",
  "phone2Label",
  "phone3",
  "phone3Label",
  "districtAutoId",
  "districtManualId",
  "metroAutoId",
  "metroManualId",
  "logoImageId",
];

function assertNoForbiddenFields(data: Record<string, unknown>): void {
  for (const field of FORBIDDEN_FIELDS) {
    assert.ok(!(field in data), `update payload must never contain "${field}"`);
  }
}

async function testCoordinatesWriteLatLng() {
  const { prisma, updateCalls } = createFakePrisma();
  const linker = new PlaceScalarLinker({ prisma });

  const result = await linker.linkScalars(
    inputFixture({ candidate: candidateFixture({ coordinates: { lat: 53.9, lng: 27.5667 } }) }),
  );

  assert.equal(updateCalls.length, 1);
  assert.deepEqual(updateCalls[0].data, { lat: 53.9, lng: 27.5667 });
  assert.equal(result.updated, true);
  assert.deepEqual(result.updatedFields.sort(), ["lat", "lng"]);
}

async function testPhoneRawWritesOnlyPhone() {
  const { prisma, updateCalls } = createFakePrisma();
  const linker = new PlaceScalarLinker({ prisma });

  const result = await linker.linkScalars(
    inputFixture({ candidate: candidateFixture({ phone: "+375291234567" }) }),
  );

  assert.deepEqual(updateCalls[0].data, { phone: "+375291234567" });
  assert.deepEqual(result.updatedFields, ["phone"]);
}

async function testLocationRawWritesOnlyCustomAddress() {
  const { prisma, updateCalls } = createFakePrisma();
  const linker = new PlaceScalarLinker({ prisma });

  const result = await linker.linkScalars(
    inputFixture({ candidate: candidateFixture({ locationRaw: "Minsk, some street 12" }) }),
  );

  assert.deepEqual(updateCalls[0].data, { customAddress: "Minsk, some street 12" });
  assert.deepEqual(result.updatedFields, ["customAddress"]);
}

async function testContextCityIdWinsAndLookupNotCalled() {
  const { prisma, updateCalls } = createFakePrisma();
  const { cityLookup, calls: lookupCalls } = createFakeCityLookup({ result: "city-from-lookup" });
  const linker = new PlaceScalarLinker({ prisma, cityLookup });

  const result = await linker.linkScalars(
    inputFixture({
      candidate: candidateFixture({ cityRaw: "Minsk" }),
      context: { cityId: "city-from-context" },
    }),
  );

  assert.equal(lookupCalls.length, 0, "cityLookup must never be called when context.cityId is provided");
  assert.deepEqual(updateCalls[0].data, { cityId: "city-from-context" });
  assert.deepEqual(result.updatedFields, ["cityId"]);
}

async function testCityRawWithLookupFoundWritesCityId() {
  const { prisma, updateCalls } = createFakePrisma();
  const { cityLookup, calls: lookupCalls } = createFakeCityLookup({ result: "city-42" });
  const linker = new PlaceScalarLinker({ prisma, cityLookup });

  const result = await linker.linkScalars(inputFixture({ candidate: candidateFixture({ cityRaw: "Minsk" }) }));

  assert.deepEqual(lookupCalls, ["Minsk"]);
  assert.deepEqual(updateCalls[0].data, { cityId: "city-42" });
  assert.deepEqual(result.updatedFields, ["cityId"]);
}

async function testCityRawWithLookupNullLeavesCityIdAbsent() {
  const { prisma, updateCalls } = createFakePrisma();
  const { cityLookup } = createFakeCityLookup({ result: null });
  const linker = new PlaceScalarLinker({ prisma, cityLookup });

  const result = await linker.linkScalars(inputFixture({ candidate: candidateFixture({ cityRaw: "Nowhereville" }) }));

  assert.equal(updateCalls.length, 0, "an unresolved city must never trigger an update by itself");
  assert.deepEqual(result, { updated: false, updatedFields: [] });
}

async function testNoCityLookupLeavesCityIdAbsent() {
  const { prisma, updateCalls } = createFakePrisma();
  const linker = new PlaceScalarLinker({ prisma });

  const result = await linker.linkScalars(inputFixture({ candidate: candidateFixture({ cityRaw: "Minsk" }) }));

  assert.equal(updateCalls.length, 0, "without an injected cityLookup, cityRaw must never be resolved or guessed");
  assert.deepEqual(result, { updated: false, updatedFields: [] });
}

async function testEmptyCandidateNoUpdate() {
  const { prisma, updateCalls } = createFakePrisma();
  const linker = new PlaceScalarLinker({ prisma });

  const result = await linker.linkScalars(inputFixture());

  assert.equal(updateCalls.length, 0);
  assert.deepEqual(result, { updated: false, updatedFields: [] });
}

async function testWorkHoursEmailMediaSourceTermsIgnored() {
  const { prisma, updateCalls } = createFakePrisma();
  const linker = new PlaceScalarLinker({ prisma });

  const result = await linker.linkScalars(
    inputFixture({
      candidate: candidateFixture({
        workHoursRaw: "Mon-Fri 9-18",
        email: "hello@example.com",
        media: { thumbnailAttachmentId: 555, galleryAttachmentIds: [111, 222] },
        sourceTerms: [{ termId: 1, taxonomy: "category", name: "Cafes", slug: "cafes" }],
      }),
    }),
  );

  assert.equal(updateCalls.length, 0, "none of workHoursRaw/email/media/sourceTerms may ever produce an update");
  assert.deepEqual(result, { updated: false, updatedFields: [] });
}

async function testUpdatePayloadNeverContainsForbiddenFields() {
  const { prisma, updateCalls } = createFakePrisma();
  const { cityLookup } = createFakeCityLookup({ result: "city-42" });
  const linker = new PlaceScalarLinker({ prisma, cityLookup });

  await linker.linkScalars(
    inputFixture({
      candidate: candidateFixture({
        coordinates: { lat: 53.9, lng: 27.5667 },
        phone: "+375291234567",
        locationRaw: "Minsk, some street 12",
        cityRaw: "Minsk",
        workHoursRaw: "Mon-Fri 9-18",
        email: "hello@example.com",
      }),
    }),
  );

  assert.equal(updateCalls.length, 1);
  assertNoForbiddenFields(updateCalls[0].data);
  assert.deepEqual(new Set(Object.keys(updateCalls[0].data)), new Set(["lat", "lng", "phone", "customAddress", "cityId"]));
}

async function testMissingPlaceIdThrows() {
  const { prisma } = createFakePrisma();
  const linker = new PlaceScalarLinker({ prisma });

  await assert.rejects(() => linker.linkScalars(inputFixture({ placeId: "" })));
}

async function main() {
  await testCoordinatesWriteLatLng();
  await testPhoneRawWritesOnlyPhone();
  await testLocationRawWritesOnlyCustomAddress();
  await testContextCityIdWinsAndLookupNotCalled();
  await testCityRawWithLookupFoundWritesCityId();
  await testCityRawWithLookupNullLeavesCityIdAbsent();
  await testNoCityLookupLeavesCityIdAbsent();
  await testEmptyCandidateNoUpdate();
  await testWorkHoursEmailMediaSourceTermsIgnored();
  await testUpdatePayloadNeverContainsForbiddenFields();
  await testMissingPlaceIdThrows();
}

main()
  .then(() => {
    console.log("PlaceScalarLinker tests: OK");
  })
  .catch((error) => {
    console.error("PlaceScalarLinker tests: FAILED", error);
    process.exitCode = 1;
  });
