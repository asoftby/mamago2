import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import NodeModule from "node:module";
import { test } from "node:test";
import { NextRequest } from "next/server";

const url = new URL(process.env.DATABASE_URL ?? "http://invalid");
assert.match(url.protocol, /^postgres(ql)?:$/);
assert.ok(["127.0.0.1", "localhost"].includes(url.hostname) && (
  (url.port === "5434" && url.pathname === "/mamago_birthday_it") ||
  (url.port === "55483" && url.pathname === "/mamago_booking_units_it")
), "Use the disposable booking units PostgreSQL database");

test("business resource lifecycle with optional offers and protected bookings", async () => {
  // Mock Next's request context only. Authentication, membership and DB writes use real code.
  let token: string | null = null;
  const moduleLoader = NodeModule as unknown as {
    _load: (request: string, ...rest: unknown[]) => unknown;
  };
  const load = moduleLoader._load;
  moduleLoader._load = function (request, ...rest) {
    if (request === "server-only") return {};
    if (request === "next/headers") return { cookies: async () => ({ get: () => token ? { value: token } : undefined }) };
    return load.apply(this, [request, ...rest]);
  };
  const { prismaBase: db } = await import("@/lib/prisma");
  try {
    const { createSession } = await import("@/lib/auth/session");
    const { GET: list, POST: create } = await import("./route");
    const { GET: detail, PUT: update } = await import("./[id]/route");
    const { POST: block } = await import("./[id]/blocks/route");
    const { POST: createOffer } = await import("../offers/route");
    const baseUrl = "http://localhost/api/business/booking-units";
    const request = (method: string, data: unknown, path = "") =>
      new NextRequest(baseUrl + path, { method, body: JSON.stringify(data) });
    const fixture = async () => {
      const key = randomUUID();
      const user = await db.user.create({ data: { email: `${key}@example.test`, status: "ACTIVE" } });
      const business = await db.business.create({
        data: { name: key, ownerUserId: user.id, operationalStatus: "ACTIVE", verificationStatus: "APPROVED" },
      });
      await db.businessMember.create({
        data: { businessId: business.id, userId: user.id, role: "OWNER", isActive: true },
      });
      return { user, business, token: await createSession(user.id) };
    };
    const owner = await fixture();
    const outsider = await fixture();
    const base = {
      name: "Зал", offerIds: [] as string[],
      prepMinutes: 15, cleanupMinutes: 10,
      rules: [{ weekday: 2, startMinutes: 600, endMinutes: 720 }],
    };

    assert.equal((await create(request("POST", base))).status, 401);
    token = owner.token;
    assert.deepEqual(await (await list()).json(), { units: [] });
    assert.equal(await db.offer.count({ where: { place: { ownerBusinessId: owner.business.id } } }), 0);
    const created = await create(request("POST", base));
    assert.equal(created.status, 201);
    const { unit: { id } } = await created.json();
    const context = { params: Promise.resolve({ id }) };
    const read = () => detail(new NextRequest(baseUrl + "/" + id), context);
    const put = (body: unknown) => update(request("PUT", body, "/" + id), context);
    const stored = await db.bookingUnit.findUniqueOrThrow({ where: { id }, include: { offers: true } });
    assert.equal(stored.placeId, null);
    assert.deepEqual(stored.offers, []);
    assert.equal((await (await list()).json()).units[0].id, id);
    const closedDate = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
    const edit = {
      ...base, name: "Зал с расписанием", status: "ACTIVE",
      expectedUpdatedAt: (await (await read()).json()).unit.updatedAt,
      exceptions: [{ date: closedDate, kind: "CLOSED", startMinutes: null, endMinutes: null }],
    };
    assert.equal((await put(edit)).status, 200);
    assert.equal((await put(edit)).status, 409, "stale resource version");
    let current = (await (await read()).json()).unit;
    assert.deepEqual(current.offers, []);
    assert.equal(current.exceptions[0].date.slice(0, 10), closedDate);

    const blockStart = new Date(Date.now() + 172_800_000);
    const blockEnd = new Date(blockStart.getTime() + 3_600_000);
    const blockRequest = () => block(request("POST", { blockStart, blockEnd }, "/" + id + "/blocks"), context);
    assert.equal((await blockRequest()).status, 201);
    assert.equal((await blockRequest()).status, 409, "overlapping manual block");
    const paused = await createOffer(request("POST", {}));
    assert.equal(paused.status, 403);
    assert.equal((await paused.json()).code, "BUSINESS_OFFER_CREATION_PAUSED");

    async function seedOffer(f: typeof owner) {
      const place = await db.place.create({
        data: { title: "Тестовая площадка", shortDesc: "Fixture", ownerBusinessId: f.business.id,
          createdByUserId: f.user.id, activityTypes: [], ageTags: [], visitFormats: [] },
      });
      return db.offer.create({
        data: { title: "Тестовая услуга", kind: "SERVICE", productType: "PARTY_SERVICE", placeId: place.id },
      });
    }
    const ownOffer = await seedOffer(owner);
    const foreignOffer = await seedOffer(outsider);
    const link = { ...edit, expectedUpdatedAt: current.updatedAt, offerIds: [ownOffer.id] };
    assert.equal((await create(request("POST", { ...base, offerIds: [ownOffer.id, foreignOffer.id] }))).status, 403);
    assert.equal((await put({ ...link, offerIds: [ownOffer.id, foreignOffer.id] })).status, 403);
    assert.equal((await put(link)).status, 200);
    current = (await (await read()).json()).unit;
    assert.deepEqual(current.offers, [{ offerId: ownOffer.id }]);
    assert.equal(current.prepMinutes, 15);
    assert.equal(current.cleanupMinutes, 10);

    token = outsider.token;
    assert.deepEqual(await (await list()).json(), { units: [] });
    assert.equal((await read()).status, 404);
    assert.equal((await put(link)).status, 404);
    token = owner.token;
    await db.business.update({ where: { id: owner.business.id }, data: { operationalStatus: "DISABLED" } });
    assert.equal((await create(request("POST", base))).status, 403);
    assert.equal((await put(link)).status, 403);
    await db.business.update({ where: { id: owner.business.id }, data: { operationalStatus: "ACTIVE" } });

    const bookingStart = new Date(blockEnd.getTime() + 3_600_000);
    const bookingEnd = new Date(bookingStart.getTime() + 3_600_000);
    const booking = await db.bookingRequest.create({
      data: {
        businessId: owner.business.id, publicationType: "OFFER", offerId: ownOffer.id, status: "CONFIRMED",
        customerName: "Тестовый клиент", customerPhone: "+375291112233",
      },
    });
    const allocation = await db.bookingAllocation.create({
      data: {
        bookingUnitId: id, bookingRequestId: booking.id, status: "CONFIRMED",
        blockStart: bookingStart, blockEnd: bookingEnd,
      },
    });
    assert.equal((await put({ ...edit, expectedUpdatedAt: current.updatedAt })).status, 409);
    assert.deepEqual((await (await read()).json()).unit, current);
    assert.equal((await db.bookingAllocation.findUniqueOrThrow({ where: { id: allocation.id } })).status, "CONFIRMED");

    // After release, clearing the final offer link is allowed without deleting booking history.
    await db.bookingAllocation.update({ where: { id: allocation.id }, data: { status: "RELEASED" } });
    assert.equal((await put({ ...edit, expectedUpdatedAt: current.updatedAt })).status, 200);
    assert.deepEqual((await (await read()).json()).unit.offers, []);
    assert.equal(await db.bookingAllocation.count({ where: { bookingUnitId: id } }), 1);
  } finally {
    moduleLoader._load = load;
    await db.$disconnect();
  }
});
