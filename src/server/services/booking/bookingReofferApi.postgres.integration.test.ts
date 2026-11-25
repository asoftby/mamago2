import assert from "node:assert/strict";
import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";
import NodeModule from "node:module";
import { test } from "node:test";
import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { addDaysLocal } from "@/lib/date/localDateKey";
import { deriveEventRequestBookingColumns } from "@/lib/event/eventRequestBookingColumns";
import { replaceActivitySessionsFromScheduleJson } from "@/lib/business/syncEventActivitySessions";
import type { Prisma } from "@prisma/client";

assert.ok(["localhost", "127.0.0.1"].includes(new URL(process.env.DATABASE_URL ?? "http://invalid").hostname), "Disposable local PostgreSQL required");
const actors = new AsyncLocalStorage<{ id: string; role: string } | null>();
const loader = NodeModule as unknown as { _load: (request: string, ...args: unknown[]) => unknown };
const originalLoad = loader._load;
let notificationCalls = 0;
loader._load = function (request, ...args) {
  if (request === "@/lib/auth/server") return { getCurrentUser: async () => actors.getStore() ?? null };
  if (request === "@/server/services/notification.service") return {
    notifyBookingCreated: async () => null,
    createNotification: async (input: { userId: string; audience: "USER"; type: "SYSTEM"; title: string; body: string; ctaLabel: string; ctaAction: string }) => {
      notificationCalls += 1;
      return prisma.notification.create({ data: input });
    },
  };
  return originalLoad.apply(this, [request, ...args]);
};

test("real reoffer API enforces consent, expiry, tenant isolation and transactional capacity", async (t) => {
  const businessRoute = await import("@/app/api/business/bookings/[id]/reoffer/route");
  const customerRoute = await import("@/app/api/booking-reoffers/[id]/route");
  const suffix = randomUUID();
  const owner = await prisma.user.create({ data: { email: "reoffer-api-owner-" + suffix + "@example.test" } });
  const client = await prisma.user.create({ data: { email: "reoffer-api-client-" + suffix + "@example.test" } });
  const other = await prisma.user.create({ data: { email: "reoffer-api-other-" + suffix + "@example.test" } });
  // The booking belongs to the second business: do not accidentally use the first membership.
  const first = await prisma.business.create({ data: { ownerUserId: owner.id, name: "Synthetic first business" } });
  const business = await prisma.business.create({ data: { ownerUserId: other.id, name: "Synthetic reoffer business" } });
  await prisma.businessMember.createMany({ data: [first, business].map((row) => ({ businessId: row.id, userId: owner.id, role: "OWNER" })) });
  const activityIds: string[] = [];
  const date = addDaysLocal(new Date(), 7);
  const schedule = (capacity: number | null = 1): Prisma.InputJsonObject => ({ participationMode: "time-slots", timeSlots: { dates: [{ isoDate: date, slots: [{ startTime: "13:00", capacity }] }] } });
  const actor = (id: string) => ({ id, role: "USER" });
  const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
  const req = (method = "GET", action?: string, origin = "https://dev.mamago.by") => new NextRequest("https://dev.mamago.by/api/synthetic", {
    method, headers: { host: "dev.mamago.by", origin, "Content-Type": "application/json" },
    ...(action ? { body: JSON.stringify({ action }) } : {}),
  });
  const call = <T>(id: string | null, fn: () => Promise<T>) => actors.run(id ? actor(id) : null, fn);
  async function rejected(activityId: string, selectedSessionId: string, userId: string | null = client.id) {
    const booking = await prisma.bookingRequest.create({ data: { businessId: business.id, activityId, selectedSessionId, userId,
      publicationType: "EVENT", status: "REJECTED", customerName: "Synthetic client", customerPhone: "+375291112233",
      requestedDate: new Date(date), requestedTime: "13:00", adultsCount: 1, childrenCount: 0 } });
    await prisma.bookingActivity.create({ data: { bookingId: booking.id, type: "STATUS_CHANGED", actorType: "BUSINESS", actorId: owner.id, payload: { to: "REJECTED", reason: "Нет мест" } } });
    return booking;
  }
  async function fixture(userId: string | null = client.id) {
    const scheduleJson = schedule();
    const activity = await prisma.activity.create({ data: { ownerUserId: owner.id, businessId: business.id, title: "Synthetic reoffer event", shortDesc: "Synthetic",
      type: "EVENT", status: "PUBLISHED", scheduleMode: "ONE_TIME", scheduleJson,
      ...deriveEventRequestBookingColumns({ participationMode: scheduleJson.participationMode, scheduleJson, current: { bookingEnabled: false, bookingMode: null }, hasBusiness: true }) } });
    activityIds.push(activity.id);
    await replaceActivitySessionsFromScheduleJson({ prisma, activityId: activity.id, scheduleJson });
    const session = await prisma.activitySession.findFirstOrThrow({ where: { activityId: activity.id } });
    const original = await rejected(activity.id, session.id, userId);
    return { activity, session, original };
  }
  const invite = (id: string) => call(owner.id, () => businessRoute.POST(req("POST"), ctx(id)));
  const reply = (id: string, action: string, userId = client.id) => call(userId, () => customerRoute.POST(req("POST", action), ctx(id)));
  try {
    await t.test("one invitation/notification, isolated DTO, double accept creates one NEW booking and preserves original history", async () => {
      const f = await fixture();
      assert.equal((await call(null, () => businessRoute.POST(req("POST"), ctx(f.original.id)))).status, 401);
      assert.equal((await call(other.id, () => businessRoute.GET(req(), ctx(f.original.id)))).status, 403);
      assert.equal((await call(owner.id, () => businessRoute.POST(req("POST", undefined, "https://evil.example"), ctx(f.original.id)))).status, 403);
      const before = notificationCalls;
      const responses = await Promise.all([invite(f.original.id), invite(f.original.id)]);
      assert.deepEqual(responses.map((r) => r.status).sort(), [201, 409]);
      assert.equal(notificationCalls - before, 1);
      const invitation = await prisma.bookingReoffer.findUniqueOrThrow({ where: { originalBookingId: f.original.id } });
      assert.equal((await call(other.id, () => customerRoute.GET(req(), ctx(invitation.id)))).status, 404);
      assert.equal((await reply(invitation.id, "ACCEPT", other.id)).status, 404);
      const detail = await call(client.id, () => customerRoute.GET(req(), ctx(invitation.id)));
      assert.equal(detail.headers.get("cache-control"), "private, no-store");
      const dto = await detail.json();
      assert.equal(dto.canAccept, true);
      assert.equal("customerPhone" in dto, false);
      assert.equal("customerUserId" in dto, false);
      const accepted = await Promise.all([reply(invitation.id, "ACCEPT"), reply(invitation.id, "ACCEPT")]);
      assert.deepEqual(accepted.map((r) => r.status), [200, 200]);
      const ids = await Promise.all(accepted.map(async (r) => (await r.json()).bookingId));
      assert.equal(ids[0], ids[1]);
      assert.equal((await prisma.bookingRequest.findUniqueOrThrow({ where: { id: ids[0] } })).status, "NEW");
      assert.equal((await prisma.bookingRequest.findUniqueOrThrow({ where: { id: f.original.id } })).status, "REJECTED");
      assert.equal(await prisma.bookingActivity.count({ where: { bookingId: f.original.id } }), 1);
      assert.equal((await reply(invitation.id, "ACCEPT")).status, 200);
      assert.equal(await prisma.bookingRequest.count({ where: { activityId: f.activity.id, status: "NEW" } }), 1);
    });
    await t.test("decline, expiry and business cancellation never create a new booking", async () => {
      for (const state of ["DECLINED", "EXPIRED", "CANCELED"] as const) {
        const f = await fixture();
        const invitation = await (await invite(f.original.id)).json();
        if (state === "DECLINED") assert.equal((await (await reply(invitation.id, "DECLINE")).json()).status, state);
        if (state === "EXPIRED") {
          await prisma.bookingReoffer.update({ where: { id: invitation.id }, data: { expiresAt: new Date(Date.now() - 1000) } });
          assert.equal((await (await reply(invitation.id, "DECLINE")).json()).status, state);
        }
        if (state === "CANCELED") await call(owner.id, () => businessRoute.DELETE(req("DELETE"), ctx(f.original.id)));
        assert.equal((await reply(invitation.id, "ACCEPT")).status, 409);
        assert.equal(await prisma.bookingRequest.count({ where: { activityId: f.activity.id } }), 1);
      }
    });
    await t.test("event disabled or withdrawn and capacity reduction block an outstanding invitation", async () => {
      for (const change of ["DISABLED", "ARCHIVED", "WITHDRAWN", "FULL", "UNLIMITED", "REQUEST_ONLY"] as const) {
        const f = await fixture();
        const invitation = await (await invite(f.original.id)).json();
        if (change === "DISABLED") await prisma.activity.update({ where: { id: f.activity.id }, data: { bookingEnabled: false } });
        if (change === "ARCHIVED") await prisma.activity.update({ where: { id: f.activity.id }, data: { status: "ARCHIVED" } });
        if (change === "WITHDRAWN") await prisma.activitySession.update({ where: { id: f.session.id }, data: { withdrawnAt: new Date() } });
        if (change === "UNLIMITED") await prisma.activity.update({ where: { id: f.activity.id }, data: { scheduleJson: schedule(null), bookingCapacityPerSlot: null } });
        if (change === "REQUEST_ONLY") await prisma.activity.update({ where: { id: f.activity.id }, data: { bookingMode: "REQUEST_ONLY" } });
        if (change === "FULL") await prisma.activity.update({ where: { id: f.activity.id }, data: { scheduleJson: schedule(0) } });
        const detail = await call(client.id, () => customerRoute.GET(req(), ctx(invitation.id)));
        assert.equal((await detail.json()).canAccept, false);
        assert.equal((await reply(invitation.id, "ACCEPT")).status, 409);
        assert.equal((await prisma.bookingReoffer.findUniqueOrThrow({ where: { id: invitation.id } })).status, "OFFERED");
      }
    });
    await t.test("two invitations race for the last seat without overbooking", async () => {
      const f = await fixture();
      const second = await rejected(f.activity.id, f.session.id, other.id);
      const invites = await Promise.all([invite(f.original.id), invite(second.id)]);
      const invitations = await Promise.all(invites.map((r) => r.json()));
      const results = await Promise.all([reply(invitations[0].id, "ACCEPT"), reply(invitations[1].id, "ACCEPT", other.id)]);
      assert.deepEqual(results.map((r) => r.status).sort(), [200, 409]);
      assert.equal(await prisma.bookingRequest.count({ where: { activityId: f.activity.id, status: "NEW" } }), 1);
    });
    await t.test("guest and revoked staff cannot send; source and foreign business remain protected", async () => {
      const f = await fixture(null);
      assert.equal((await invite(f.original.id)).status, 422);
      const registered = await fixture();
      await prisma.businessMember.updateMany({ where: { businessId: business.id, userId: owner.id }, data: { isActive: false } });
      assert.equal((await invite(registered.original.id)).status, 403);
      await prisma.businessMember.updateMany({ where: { businessId: business.id, userId: owner.id }, data: { isActive: true } });
      assert.equal(await prisma.bookingReoffer.count({ where: { originalBookingId: { in: [f.original.id, registered.original.id] } } }), 0);
    });
    assert.equal(await prisma.bookingSmsDelivery.count({ where: { booking: { businessId: business.id } } }), 0);
  } finally {
    loader._load = originalLoad;
    await prisma.notification.deleteMany({ where: { userId: { in: [owner.id, client.id, other.id] } } });
    await prisma.bookingRequest.deleteMany({ where: { businessId: business.id } });
    await prisma.activity.deleteMany({ where: { id: { in: activityIds } } });
    await prisma.business.deleteMany({ where: { id: { in: [first.id, business.id] } } });
    await prisma.user.deleteMany({ where: { id: { in: [owner.id, client.id, other.id] } } });
    await prisma.$disconnect();
  }
});
