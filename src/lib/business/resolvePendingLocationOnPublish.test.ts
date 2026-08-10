/**
 * Unit test for resolvePendingLocationOnPublish.
 * Covers Task 4 fix: googlePlaceId / addressJson / districtAutoId / metroAutoId must
 * survive from the Event Wizard's Google Places selection through to the Place row
 * created at publish time (previously hardcoded to null).
 * Run: npx tsx src/lib/business/resolvePendingLocationOnPublish.test.ts
 */
import assert from "node:assert/strict";
import { Prisma } from "@prisma/client";
import { resolvePendingLocationOnPublish } from "./resolvePendingLocationOnPublish";

type FakeCity = { id: string; slug: string; isLegacyNonCity: boolean; country: { isoCode: string } };
type FakeDistrict = { id: string; cityId: string };
type FakeMetro = { id: string; cityId: string };
type FakeExistingPlace = {
  id: string;
  title: string;
  formattedAddr: string | null;
  lat: number | null;
  lng: number | null;
};

function createFakeTx(opts: {
  cities?: FakeCity[];
  districts?: FakeDistrict[];
  metroStations?: FakeMetro[];
  existingPlaces?: FakeExistingPlace[];
}) {
  const placeCreates: Record<string, unknown>[] = [];
  const eventVenueUpserts: { create: Record<string, unknown>; update: Record<string, unknown> }[] = [];

  const tx = {
    city: {
      findUnique: async ({ where }: { where: { id: string } }) =>
        opts.cities?.find((c) => c.id === where.id) ?? null,
      findFirst: async ({ where }: { where: { slug: string } }) =>
        opts.cities?.find((c) => c.slug === where.slug) ?? null,
    },
    district: {
      findFirst: async ({ where }: { where: { id: string; cityId: string } }) =>
        opts.districts?.find((d) => d.id === where.id && d.cityId === where.cityId) ?? null,
    },
    metroStation: {
      findFirst: async ({ where }: { where: { id: string; cityId: string } }) =>
        opts.metroStations?.find((m) => m.id === where.id && m.cityId === where.cityId) ?? null,
    },
    place: {
      findMany: async () => opts.existingPlaces ?? [],
      create: async ({ data }: { data: Record<string, unknown> }) => {
        placeCreates.push(data);
        return { id: "new-place-id" };
      },
    },
    eventVenue: {
      upsert: async ({
        create,
        update,
      }: {
        create: Record<string, unknown>;
        update: Record<string, unknown>;
      }) => {
        eventVenueUpserts.push({ create, update });
        return create;
      },
    },
  };

  return { tx: tx as unknown as Prisma.TransactionClient, placeCreates, eventVenueUpserts };
}

async function run() {
  // 1. NEW_PLACE with Google-resolved data + valid district/metro must persist all of it
  {
    const { tx, placeCreates } = createFakeTx({
      cities: [{ id: "city-1", slug: "minsk", isLegacyNonCity: false, country: { isoCode: "BY" } }],
      districts: [{ id: "district-1", cityId: "city-1" }],
      metroStations: [{ id: "metro-1", cityId: "city-1" }],
      existingPlaces: [],
    });

    const scheduleJson = {
      pendingLocation: {
        mode: "NEW_PLACE",
        title: "Детский центр Песочница",
        address: "Притыцкого 12, Минск",
        city: "city-1",
        lat: 53.9,
        lng: 27.5,
        source: "manual",
        googlePlaceId: "ChIJ-google-place-id",
        addressJson: [{ long_name: "Притыцкого", types: ["route"] }],
        districtAutoId: "district-1",
        metroAutoId: "metro-1",
        metroAutoDistanceM: 420,
      },
    };

    const result = await resolvePendingLocationOnPublish(tx, "activity-1", scheduleJson, "user-1", "biz-1");

    assert.equal(result.placeCreated, true, "expected a new Place to be created");
    assert.equal(placeCreates.length, 1);
    const created = placeCreates[0]!;
    assert.equal(created.googlePlaceId, "ChIJ-google-place-id", "googlePlaceId must survive to Place.create");
    assert.deepEqual(
      created.addressJson,
      [{ long_name: "Притыцкого", types: ["route"] }],
      "addressJson must survive to Place.create",
    );
    assert.equal(created.districtAutoId, "district-1", "districtAutoId must survive when valid for city");
    assert.equal(created.metroAutoId, "metro-1", "metroAutoId must survive when valid for city");
    assert.equal(created.metroAutoDistanceM, 420);
    assert.equal(created.locationSource, "GOOGLE", "locationSource must be GOOGLE when googlePlaceId present");
  }

  // 2. PARSED_LOCATION (no Google data at all) must keep prior null behavior — no regression
  {
    const { tx, placeCreates } = createFakeTx({
      cities: [{ id: "city-1", slug: "minsk", isLegacyNonCity: false, country: { isoCode: "BY" } }],
      existingPlaces: [],
    });

    const scheduleJson = {
      pendingLocation: {
        mode: "PARSED_LOCATION",
        title: "Парк Дрозды",
        address: "Дрозды",
        city: "minsk",
        source: "parser",
      },
    };

    const result = await resolvePendingLocationOnPublish(tx, "activity-2", scheduleJson, "user-1", "biz-1");

    assert.equal(result.placeCreated, true);
    const created = placeCreates[0]!;
    assert.equal(created.googlePlaceId, null, "no googlePlaceId in pendingLocation -> null, unchanged");
    assert.equal(created.addressJson, Prisma.JsonNull, "no addressJson in pendingLocation -> Prisma.JsonNull, unchanged");
    assert.equal(created.districtAutoId, null);
    assert.equal(created.metroAutoId, null);
    assert.equal(created.locationSource, "MANUAL");
  }

  // 3. Stale district/metro ids (wrong city or deleted) must be dropped, not crash or leak cross-city refs
  {
    const { tx, placeCreates } = createFakeTx({
      cities: [{ id: "city-1", slug: "minsk", isLegacyNonCity: false, country: { isoCode: "BY" } }],
      districts: [{ id: "district-in-other-city", cityId: "city-99" }],
      metroStations: [],
      existingPlaces: [],
    });

    const scheduleJson = {
      pendingLocation: {
        mode: "NEW_PLACE",
        title: "Кафе Тест",
        address: "Тестовая 1",
        city: "city-1",
        lat: 53.9,
        lng: 27.5,
        googlePlaceId: "ChIJ-stale-test",
        districtAutoId: "district-in-other-city", // belongs to a different city
        metroAutoId: "metro-does-not-exist",
      },
    };

    const result = await resolvePendingLocationOnPublish(tx, "activity-3", scheduleJson, "user-1", "biz-1");
    assert.equal(result.placeCreated, true);
    const created = placeCreates[0]!;
    assert.equal(created.districtAutoId, null, "district from another city must not be attached");
    assert.equal(created.metroAutoId, null, "nonexistent metro id must not be attached");
    assert.equal(created.googlePlaceId, "ChIJ-stale-test", "googlePlaceId itself is unaffected by geo staleness");
  }

  // 4. EXISTING_PLACE mode must remain unaffected — no Place created, just EventVenue linked
  {
    const { tx, placeCreates, eventVenueUpserts } = createFakeTx({});

    const scheduleJson = {
      pendingLocation: {
        mode: "EXISTING_PLACE",
        placeId: "place-existing-1",
        title: "Существующее место",
        address: "Уже сохранённый адрес",
      },
    };

    const result = await resolvePendingLocationOnPublish(tx, "activity-4", scheduleJson, "user-1", "biz-1");
    assert.equal(result.placeId, "place-existing-1");
    assert.equal(result.placeCreated, false);
    assert.equal(placeCreates.length, 0, "must not create a new Place for an existing selection");
    assert.equal(eventVenueUpserts.length, 1);
    assert.equal(eventVenueUpserts[0]!.create.placeId, "place-existing-1");
  }

  // 5. Invalid/empty selection must not corrupt data
  {
    const { tx, placeCreates, eventVenueUpserts } = createFakeTx({});

    // No pendingLocation at all
    const result1 = await resolvePendingLocationOnPublish(tx, "activity-5", {}, "user-1", "biz-1");
    assert.equal(result1.placeId, null);
    assert.equal(result1.placeCreated, false);

    // NEW_PLACE with no title must not create a Place
    const result2 = await resolvePendingLocationOnPublish(
      tx,
      "activity-5",
      { pendingLocation: { mode: "NEW_PLACE", address: "some address", lat: 1, lng: 1 } },
      "user-1",
      "biz-1",
    );
    assert.equal(result2.placeId, null);
    assert.equal(result2.placeCreated, false);
    assert.equal(placeCreates.length, 0);
    assert.equal(eventVenueUpserts.length, 0);
  }

  console.log("resolvePendingLocationOnPublish.test.ts: all assertions passed");
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
