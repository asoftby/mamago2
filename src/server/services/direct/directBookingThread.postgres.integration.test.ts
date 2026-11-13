/**
 * Direct ↔ BookingRequest: business opens a thread on a customer's request.
 * Needs disposable localhost PostgreSQL and `--conditions=react-server`:
 *   NODE_OPTIONS=--conditions=react-server npx tsx --test <this file>
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, test } from "node:test";
import { BookingStatus, DirectActorType, PublicationType } from "@prisma/client";
import prisma from "@/lib/prisma";
import { requireDirectThreadAccess, DirectAccessError } from "@/lib/auth/directAccess";
import {
  attachDirectLinksToParentBookings,
  BookingDirectError,
  getBookingThreadIndicators,
  openBusinessDirectThreadForBooking,
  openCustomerDirectThreadForBooking,
} from "./directBookingThread.service";
import { createDirectMessage } from "./directMessage.service";
import { DirectSendLimitError } from "./directRiskSignal.service";
import {
  getDirectPlatformSettings,
  updateDirectPlatformSettings,
} from "./directPlatformSettings.service";
import { notifyDirectMessage } from "@/server/services/notification.service";
import { getParentBookings } from "@/server/services/booking/parentBookings.service";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl || !["localhost", "127.0.0.1"].includes(new URL(databaseUrl).hostname)) {
  throw new Error("Direct booking-thread tests require disposable localhost PostgreSQL");
}

const sfx = randomUUID().slice(0, 10);
const id = (name: string) => `dbt-${name}-${sfx}`;
const owner = id("owner");
const manager = id("manager");
const customer = id("customer");
const stranger = id("stranger");
const otherOwner = id("other-owner");
const users = [owner, manager, customer, stranger, otherOwner];
let businessId = "";
let otherBusinessId = "";
let activityId = "";
let originalPolicy: Awaited<ReturnType<typeof getDirectPlatformSettings>>["publicationTypePolicy"];
const bookingIds: string[] = [];

async function newBooking(overrides: Partial<{ userId: string | null; status: BookingStatus }> = {}) {
  const b = await prisma.bookingRequest.create({
    data: {
      businessId,
      publicationType: PublicationType.EVENT,
      activityId,
      customerName: "Тест",
      customerPhone: "+375291112233",
      status: BookingStatus.NEW,
      userId: customer,
      ...overrides,
    },
  });
  bookingIds.push(b.id);
  return b;
}

before(async () => {
  await prisma.user.createMany({ data: users.map((u) => ({ id: u, email: `${u}@example.test` })) });
  businessId = (await prisma.business.create({ data: { name: "DBT biz " + sfx, ownerUserId: owner } })).id;
  otherBusinessId = (await prisma.business.create({ data: { name: "DBT other " + sfx, ownerUserId: otherOwner } })).id;
  await prisma.businessMember.createMany({
    data: [
      { businessId, userId: owner, role: "OWNER", isActive: true },
      { businessId, userId: manager, role: "MANAGER", isActive: true },
      { businessId: otherBusinessId, userId: otherOwner, role: "OWNER", isActive: true },
    ],
  });
  activityId = (
    await prisma.activity.create({
      data: {
        ownerUserId: owner, businessId, title: "DBT event " + sfx, shortDesc: "x",
        type: "EVENT", scheduleMode: "ALWAYS",
      },
    })
  ).id;
  originalPolicy = (await getDirectPlatformSettings()).publicationTypePolicy;
});

after(async () => {
  await updateDirectPlatformSettings({ publicationTypePolicy: originalPolicy }, { userId: owner, role: "ADMIN" }).catch(() => {});
  const threads = await prisma.directThread.findMany({ where: { businessId }, select: { id: true } });
  const threadIds = threads.map((t) => t.id);
  await prisma.directRiskSignal.deleteMany({ where: { businessId } });
  await prisma.directMessage.deleteMany({ where: { threadId: { in: threadIds } } });
  await prisma.directThread.deleteMany({ where: { id: { in: threadIds } } });
  await prisma.notification.deleteMany({ where: { userId: { in: users } } });
  await prisma.bookingRequest.deleteMany({ where: { id: { in: bookingIds } } });
  await prisma.activity.deleteMany({ where: { id: activityId } });
  await prisma.businessMember.deleteMany({ where: { userId: { in: users } } });
  await prisma.business.deleteMany({ where: { id: { in: [businessId, otherBusinessId] } } });
  await prisma.adminAuditLog.deleteMany({ where: { actorId: { in: users } } }).catch(() => {});
  await prisma.user.deleteMany({ where: { id: { in: users } } });
  await prisma.$disconnect();
});

const codeOf = async (p: Promise<unknown>) => {
  try { await p; } catch (e) { return e instanceof BookingDirectError ? e.code : `other:${(e as Error).message}`; }
  return "NO_ERROR";
};

test("manager opens a thread on a customer's request: BUSINESS first message, linked to the booking", async () => {
  const booking = await newBooking();
  const r = await openBusinessDirectThreadForBooking({ bookingRequestId: booking.id, actorUserId: manager, message: "  Здравствуйте!  " });
  assert.equal(r.created, true);
  assert.equal(r.customerUserId, customer);
  const t = await prisma.directThread.findUniqueOrThrow({ where: { id: r.threadId }, include: { messages: true } });
  assert.equal(t.bookingRequestId, booking.id);
  assert.equal(t.publicationType, "EVENT");
  assert.equal(t.activityId, activityId);
  assert.equal(t.businessId, businessId);
  assert.equal(t.customerUserId, customer);
  assert.equal(t.lastMessageBy, DirectActorType.BUSINESS);
  assert.equal(t.messages.length, 1);
  assert.equal(t.messages[0].senderType, DirectActorType.BUSINESS);
  assert.equal(t.messages[0].senderUserId, manager);
  assert.equal(t.messages[0].body, "Здравствуйте!");
});

test("idempotent: repeated open returns the same thread and writes nothing", async () => {
  const booking = await newBooking();
  const a = await openBusinessDirectThreadForBooking({ bookingRequestId: booking.id, actorUserId: owner, message: "Первое" });
  const b = await openBusinessDirectThreadForBooking({ bookingRequestId: booking.id, actorUserId: manager, message: "Второе" });
  assert.equal(b.created, false);
  assert.equal(b.threadId, a.threadId);
  assert.equal(await prisma.directMessage.count({ where: { threadId: a.threadId } }), 1);
});

test("race: parallel opens yield exactly one thread and one message", async () => {
  const booking = await newBooking();
  const results = await Promise.all(
    Array.from({ length: 6 }, (_, i) =>
      openBusinessDirectThreadForBooking({ bookingRequestId: booking.id, actorUserId: i % 2 ? owner : manager, message: "гонка " + i }),
    ),
  );
  assert.equal(new Set(results.map((r) => r.threadId)).size, 1);
  assert.equal(results.filter((r) => r.created).length, 1);
  assert.equal(await prisma.directThread.count({ where: { bookingRequestId: booking.id } }), 1);
  assert.equal(await prisma.directMessage.count({ where: { threadId: results[0].threadId } }), 1);
});

test("guest request, foreign business, customer and empty text are rejected without writes", async () => {
  const guest = await newBooking({ userId: null });
  assert.equal(await codeOf(openBusinessDirectThreadForBooking({ bookingRequestId: guest.id, actorUserId: owner, message: "hi" })), "GUEST_BOOKING");
  const booking = await newBooking();
  for (const actor of [otherOwner, customer, stranger]) {
    assert.equal(await codeOf(openBusinessDirectThreadForBooking({ bookingRequestId: booking.id, actorUserId: actor, message: "hi" })), "FORBIDDEN");
  }
  assert.equal(await codeOf(openBusinessDirectThreadForBooking({ bookingRequestId: booking.id, actorUserId: owner, message: "   " })), "EMPTY_MESSAGE");
  assert.equal(await codeOf(openBusinessDirectThreadForBooking({ bookingRequestId: "nope", actorUserId: owner, message: "hi" })), "BOOKING_NOT_FOUND");
  const cancelled = await newBooking({ status: BookingStatus.CANCELLED });
  assert.equal(await codeOf(openBusinessDirectThreadForBooking({ bookingRequestId: cancelled.id, actorUserId: owner, message: "hi" })), "PUBLICATION_MISMATCH");
  assert.equal(await prisma.directThread.count({ where: { bookingRequestId: { in: [guest.id, booking.id, cancelled.id] } } }), 0);
});

test("platform policy disabled → no thread (and restored policy allows again)", async () => {
  const settings = await getDirectPlatformSettings();
  const off = { ...settings.publicationTypePolicy, EVENT: { ...settings.publicationTypePolicy.EVENT, enabled: false } };
  await updateDirectPlatformSettings({ publicationTypePolicy: off }, { userId: owner, role: "ADMIN" });
  try {
    const booking = await newBooking();
    assert.equal(await codeOf(openBusinessDirectThreadForBooking({ bookingRequestId: booking.id, actorUserId: owner, message: "hi" })), "POLICY_DISABLED");
    assert.equal(await codeOf(openCustomerDirectThreadForBooking({ bookingRequestId: booking.id, customerUserId: customer, message: "hi" })), "POLICY_DISABLED");
    assert.equal(await prisma.directThread.count({ where: { bookingRequestId: booking.id } }), 0);
    const result = await attachDirectLinksToParentBookings(await getParentBookings(customer), customer);
    const item = [...result.active, ...result.completed, ...result.cancelled].find((b) => b.id === booking.id)!;
    assert.equal(item.directAvailable, false);
  } finally {
    await updateDirectPlatformSettings({ publicationTypePolicy: settings.publicationTypePolicy }, { userId: owner, role: "ADMIN" });
  }
});

test("contact detection runs on the business first message", async () => {
  const booking = await newBooking();
  const r = await openBusinessDirectThreadForBooking({ bookingRequestId: booking.id, actorUserId: owner, message: "Звоните +375 29 123-45-67 или в telegram" });
  const signals = await prisma.directRiskSignal.findMany({ where: { threadId: r.threadId } });
  const types = signals.map((s) => s.signalType);
  assert.ok(types.includes("CONTACT_PHONE"));
  assert.ok(types.includes("CONTACT_TELEGRAM"));
  assert.ok(signals.every((s) => s.messageId === r.firstMessageId));
});

test("no-reply cap counts the BUSINESS first message; customer reply resets it", async () => {
  const { noReplyCapCount } = await getDirectPlatformSettings();
  const booking = await newBooking();
  const r = await openBusinessDirectThreadForBooking({ bookingRequestId: booking.id, actorUserId: owner, message: "m1" });
  const send = (senderType: DirectActorType, who: string) =>
    createDirectMessage({ threadId: r.threadId, senderType, senderUserId: who, body: "x" });
  for (let i = 1; i < noReplyCapCount; i++) await send("BUSINESS", owner);
  await assert.rejects(send("BUSINESS", owner), (e: unknown) => e instanceof DirectSendLimitError && e.kind === "NO_REPLY_CAP");
  assert.ok(await prisma.directRiskSignal.count({ where: { threadId: r.threadId, signalType: "NO_REPLY_CAP_TRIGGERED" } }) >= 1);
  await send("CUSTOMER", customer);
  await send("BUSINESS", owner);
});

test("customer notification: organizer reply text, /me/direct link, no duplicate", async () => {
  const booking = await newBooking();
  const r = await openBusinessDirectThreadForBooking({ bookingRequestId: booking.id, actorUserId: owner, message: "Привет" });
  const params = {
    recipientUserId: customer, recipientSurface: "USER" as const, threadId: r.threadId,
    threadNumber: r.threadNumber, messageId: r.firstMessageId!, organizerReplyToBooking: true,
  };
  await notifyDirectMessage(params);
  await notifyDirectMessage(params);
  const rows = await prisma.notification.findMany({ where: { userId: customer, entityId: r.firstMessageId! } });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].ctaAction, `/me/direct/${r.threadId}`);
  assert.match(rows[0].title, /Организатор написал/);
});

test("ACL: only the customer and business members access the thread", async () => {
  const booking = await newBooking();
  const r = await openBusinessDirectThreadForBooking({ bookingRequestId: booking.id, actorUserId: owner, message: "Привет" });
  const actor = (userId: string) => ({ id: userId, role: "USER" }) as never;
  await requireDirectThreadAccess(actor(customer), r.threadId);
  await requireDirectThreadAccess(actor(manager), r.threadId);
  for (const u of [stranger, otherOwner]) {
    await assert.rejects(requireDirectThreadAccess(actor(u), r.threadId), (e: unknown) => e instanceof DirectAccessError && e.status === 403);
  }
  await assert.rejects(requireDirectThreadAccess(null, r.threadId), (e: unknown) => e instanceof DirectAccessError && e.status === 401);
  // Indicators are scoped: foreign viewers see nothing even for a valid booking id.
  assert.equal((await getBookingThreadIndicators([booking.id], { customerUserId: customer })).get(booking.id)?.threadId, r.threadId);
  assert.equal((await getBookingThreadIndicators([booking.id], { businessId })).get(booking.id)?.threadId, r.threadId);
  assert.equal((await getBookingThreadIndicators([booking.id], { customerUserId: stranger })).size, 0);
  assert.equal((await getBookingThreadIndicators([booking.id], { businessId: otherBusinessId })).size, 0);
});

test("customer side: 'Мои записи' shows the thread link; another user's list does not", async () => {
  const booking = await newBooking({ status: BookingStatus.EXPIRED });
  const before = await attachDirectLinksToParentBookings(await getParentBookings(customer), customer);
  const find = (res: typeof before) => [...res.active, ...res.completed, ...res.cancelled].find((b) => b.id === booking.id);
  assert.equal(find(before)?.directThreadId, null);
  assert.equal(find(before)?.directAvailable, true);

  // Customer writes to the organizer about the expired request.
  assert.equal(await codeOf(openCustomerDirectThreadForBooking({ bookingRequestId: booking.id, customerUserId: stranger, message: "hi" })), "NOT_BOOKING_OWNER");
  const c = await openCustomerDirectThreadForBooking({ bookingRequestId: booking.id, customerUserId: customer, message: "Вы не ответили" });
  assert.equal(c.created, true);
  const t = await prisma.directThread.findUniqueOrThrow({ where: { id: c.threadId } });
  assert.equal(t.bookingRequestId, booking.id);
  assert.equal(t.lastMessageBy, DirectActorType.CUSTOMER);

  const after = await attachDirectLinksToParentBookings(await getParentBookings(customer), customer);
  assert.equal(find(after)?.directThreadId, c.threadId);

  // Second submit (or the business opened it first) appends instead of duplicating.
  const again = await openCustomerDirectThreadForBooking({ bookingRequestId: booking.id, customerUserId: customer, message: "ещё" });
  assert.equal(again.created, false);
  assert.equal(again.threadId, c.threadId);
  assert.ok(again.appendedMessageId);
  assert.equal(await prisma.directThread.count({ where: { bookingRequestId: booking.id } }), 1);

  // Business open on an existing customer-created thread also returns it.
  const biz = await openBusinessDirectThreadForBooking({ bookingRequestId: booking.id, actorUserId: owner, message: "Простите" });
  assert.equal(biz.created, false);
  assert.equal(biz.threadId, c.threadId);
});
