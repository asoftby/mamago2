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
import { createDirectMessage, DirectBusinessWriteError } from "./directMessage.service";
import { markThreadRead } from "./directThread.service";
import { getBusinessConversationsForUser, getCustomerConversationsForUser, getUnifiedConversationDetail } from "./directConversation.service";
import { DirectSendLimitError } from "./directRiskSignal.service";
import {
  getDirectPlatformSettings,
  updateDirectPlatformSettings,
} from "./directPlatformSettings.service";
import { getUnifiedNotificationFeed, getUnreadCount, notifyDirectMessage } from "@/server/services/notification.service";
import {
  getBusinessDirectRecipientUserIds,
  notifyBusinessStaffDirectCreated,
  notifyBusinessStaffDirectMessage,
  shouldPingStaffAboutThread,
} from "./directStaffNotify";
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
    assert.equal(await codeOf(openBusinessDirectThreadForBooking({ bookingRequestId: booking.id, actorUserId: actor, message: "hi" })), "BOOKING_NOT_FOUND");
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

// Notification delivery rows are written in the background; cleanup must not race them (40P01).
async function waitForDeliveriesToSettle(entityIds: string[]) {
  const deadline = Date.now() + 15_000;
  let previous = "";
  for (;;) {
    const notifications = await prisma.notification.findMany({
      where: { entityId: { in: entityIds } },
      select: { deliveries: { select: { status: true } } },
    });
    const settled = notifications.every(({ deliveries }) => deliveries.length > 0 && deliveries.every(({ status }) => status !== "PENDING"));
    const snapshot = JSON.stringify(notifications.map(({ deliveries }) => deliveries.length));
    if (settled && snapshot === previous) return;
    previous = snapshot;
    if (Date.now() > deadline) throw new Error("Timed out waiting for notification deliveries");
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
}

test("staff notifications: owner and active managers are told once; inactive members and strangers are not", async () => {
  const inactive = id("inactive-manager");
  await prisma.user.create({ data: { id: inactive, email: `${inactive}@example.test` } });
  users.push(inactive);
  await prisma.businessMember.create({ data: { businessId, userId: inactive, role: "MANAGER", isActive: false } });

  const expected = [owner, manager].sort();
  assert.deepEqual((await getBusinessDirectRecipientUserIds(businessId)).sort(), expected);

  const booking = await newBooking();
  const r = await openBusinessDirectThreadForBooking({ bookingRequestId: booking.id, actorUserId: owner, message: "Привет" });
  const messageId = r.firstMessageId!;

  await notifyBusinessStaffDirectCreated({ businessId, threadId: r.threadId, threadNumber: r.threadNumber });
  const createdRows = await prisma.notification.findMany({ where: { entityId: r.threadId, type: "DIRECT_THREAD_CREATED" } });
  assert.deepEqual(createdRows.map((n) => n.userId).sort(), expected);

  const messageParams = { businessId, threadId: r.threadId, threadNumber: r.threadNumber, messageId };
  await notifyBusinessStaffDirectMessage(messageParams);
  await notifyBusinessStaffDirectMessage(messageParams); // retry must not double-notify
  const messageRows = await prisma.notification.findMany({ where: { entityId: messageId, type: "DIRECT_NEW_MESSAGE" } });
  assert.deepEqual(messageRows.map((n) => n.userId).sort(), expected);
  assert.ok(messageRows.every((n) => n.audience === "BUSINESS" && n.ctaAction === `/business/direct/${r.threadId}`));

  // Nobody outside the business team was notified.
  assert.equal(await prisma.notification.count({ where: { entityId: { in: [messageId, r.threadId] }, userId: { in: [customer, stranger, otherOwner, inactive] } } }), 0);
  await waitForDeliveriesToSettle([messageId, r.threadId]);
});

test("staff notifications: an owner without a membership row is still a recipient", async () => {
  const soloBusiness = await prisma.business.create({ data: { name: "DBT solo " + sfx, ownerUserId: stranger } });
  try {
    assert.deepEqual(await getBusinessDirectRecipientUserIds(soloBusiness.id), [stranger]);
    assert.deepEqual(await getBusinessDirectRecipientUserIds("missing-" + sfx), []);
  } finally {
    await prisma.business.delete({ where: { id: soloBusiness.id } });
  }
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
  assert.equal(await codeOf(openCustomerDirectThreadForBooking({ bookingRequestId: booking.id, customerUserId: stranger, message: "hi" })), "BOOKING_NOT_FOUND");
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

test("past dated booking closes despite stale CONFIRMED status and null endsAt", async () => {
  const booking = await newBooking({ status: BookingStatus.CONFIRMED });
  await prisma.bookingRequest.update({
    where: { id: booking.id },
    data: { requestedDate: new Date(Date.now() - 3 * 86_400_000) },
  });
  assert.equal(await codeOf(openBusinessDirectThreadForBooking({
    bookingRequestId: booking.id, actorUserId: owner, message: "Обратитесь напрямую",
  })), "BOOKING_INACTIVE");
  assert.equal(await prisma.directThread.count({ where: { bookingRequestId: booking.id } }), 0);
});

test("terminal and elapsed bookings cannot start a business-authored thread", async () => {
  for (const status of [BookingStatus.EXPIRED, BookingStatus.REJECTED, BookingStatus.COMPLETED]) {
    const booking = await newBooking({ status });
    assert.equal(
      await codeOf(openBusinessDirectThreadForBooking({
        bookingRequestId: booking.id, actorUserId: owner, message: "Повторное предложение",
      })),
      "BOOKING_INACTIVE",
    );
    assert.equal(await prisma.directThread.count({ where: { bookingRequestId: booking.id } }), 0);
  }
  const elapsed = await newBooking();
  await prisma.bookingRequest.update({
    where: { id: elapsed.id },
    data: { endsAt: new Date(Date.now() - 60_000) },
  });
  assert.equal(
    await codeOf(openBusinessDirectThreadForBooking({
      bookingRequestId: elapsed.id, actorUserId: owner, message: "Услуга уже прошла",
    })),
    "BOOKING_INACTIVE",
  );
});

test("stale OPEN booking thread cannot bypass a terminal status via message API service", async () => {
  const booking = await newBooking();
  const opened = await openBusinessDirectThreadForBooking({
    bookingRequestId: booking.id, actorUserId: owner, message: "Подтверждаем детали",
  });
  await prisma.bookingRequest.update({
    where: { id: booking.id }, data: { status: BookingStatus.COMPLETED },
  });
  const attempted = () => createDirectMessage({
    threadId: opened.threadId, senderType: DirectActorType.BUSINESS,
    senderUserId: owner, body: "Приходите снова без mamaGo",
  });
  await assert.rejects(attempted(), DirectBusinessWriteError);
  assert.equal(await prisma.directMessage.count({ where: { threadId: opened.threadId } }), 1);
  // Customer is not locked out of their history/possibility to raise a problem.
  await createDirectMessage({
    threadId: opened.threadId, senderType: DirectActorType.CUSTOMER,
    senderUserId: customer, body: "У меня вопрос по завершённому заказу",
  });
  await assert.rejects(attempted(), DirectBusinessWriteError);
});

test("unlinked old customer enquiry cannot be revived by business without fresh inbound", async () => {
  const old = new Date(Date.now() - 31 * 24 * 60 * 60_000);
  const thread = await prisma.directThread.create({
    data: {
      publicationType: PublicationType.EVENT,
      activityId, businessId, customerUserId: customer,
      lastMessageAt: old,
      lastMessageBy: DirectActorType.CUSTOMER,
      messages: {
        create: { senderType: DirectActorType.CUSTOMER, senderUserId: customer,
          body: "Старый вопрос", createdAt: old },
      },
    },
  });
  const reply = () => createDirectMessage({
    threadId: thread.id, senderType: DirectActorType.BUSINESS,
    senderUserId: owner, body: "Новое предложение",
  });
  await assert.rejects(reply(), DirectBusinessWriteError);
  await createDirectMessage({
    threadId: thread.id, senderType: DirectActorType.CUSTOMER,
    senderUserId: customer, body: "Уточняю свой вопрос",
  });
  await reply();
  assert.equal(await prisma.directMessage.count({ where: { threadId: thread.id } }), 3);
});


test("business message inbox is scoped by occasion and never aggregates a customer's multiple bookings", async () => {
  const firstBooking = await newBooking();
  const secondBooking = await newBooking();
  const first = await openBusinessDirectThreadForBooking({
    bookingRequestId: firstBooking.id, actorUserId: owner, message: "Первый заказ",
  });
  const second = await openBusinessDirectThreadForBooking({
    bookingRequestId: secondBooking.id, actorUserId: owner, message: "Второй заказ",
  });

  const businessRows = await getBusinessConversationsForUser(owner, businessId);
  const one = businessRows.find((row) => row.latestThreadId === first.threadId);
  const two = businessRows.find((row) => row.latestThreadId === second.threadId);
  assert.ok(one && two);
  assert.notEqual(one.key, two.key);
  assert.equal(one.occasionCount, 1);
  assert.equal(two.occasionCount, 1);
  assert.equal(one.counterpartyLogoUrl, null);
  assert.match(one.counterpartyName, /^Обращение D-\d+$/);

  const businessDetail = await getUnifiedConversationDetail(businessId, customer, "BUSINESS", first.threadId);
  assert.deepEqual(businessDetail?.occasions.map((o) => o.threadId), [first.threadId]);
  assert.deepEqual(businessDetail?.messages.map((m) => m.body), ["Первый заказ"]);
  assert.equal(businessDetail?.counterpartyLogoUrl, null);
  assert.equal(businessDetail?.customerUserId, null, "Business cannot correlate separate orders using a permanent customer ID");
  assert.equal(await getUnifiedConversationDetail(businessId, customer, "BUSINESS"), null,
    "Business read without scoped thread must fail closed");

  const customerDetail = await getUnifiedConversationDetail(businessId, customer, "CUSTOMER");
  assert.equal(customerDetail?.customerUserId, customer, "Customer view retains its own identity");
  assert.ok(customerDetail?.occasions.some((o) => o.threadId === first.threadId));
  assert.ok(customerDetail?.occasions.some((o) => o.threadId === second.threadId));

  await prisma.bookingRequest.update({ where: { id: secondBooking.id }, data: { status: BookingStatus.COMPLETED } });
  const businessAfterCompletion = await getBusinessConversationsForUser(owner, businessId);
  assert.equal(businessAfterCompletion.find((row) => row.latestThreadId === second.threadId)?.tab, "COMPLETED");
  assert.equal((await getUnifiedConversationDetail(businessId, customer, "BUSINESS", second.threadId))?.canWrite, false);
});

test("read receipts: only CUSTOMER/BUSINESS messages carry one; ADMIN messages never confirm the customer read", async () => {
  const booking = await newBooking();
  const r = await openBusinessDirectThreadForBooking({ bookingRequestId: booking.id, actorUserId: owner, message: "Привет" });
  await createDirectMessage({ threadId: r.threadId, senderType: DirectActorType.ADMIN, senderUserId: owner, body: "Сообщение поддержки" });

  // The business opens the dialog: markThreadRead also marks the ADMIN message read (for either reader).
  await markThreadRead({ threadId: r.threadId, readerType: DirectActorType.BUSINESS });
  const before = await getUnifiedConversationDetail(businessId, customer, "BUSINESS", r.threadId);
  const byBody = (detail: typeof before, body: string) => detail?.messages.find((m) => m.body === body);
  assert.equal(byBody(before, "Привет")?.readAt, null, "customer has not read the business message yet");
  assert.equal(byBody(before, "Сообщение поддержки")?.readAt, null, "ADMIN message must not show a read receipt");

  // The customer opens the dialog: the business message is now read; the ADMIN one still carries nothing.
  await markThreadRead({ threadId: r.threadId, readerType: DirectActorType.CUSTOMER });
  const after = await getUnifiedConversationDetail(businessId, customer, "BUSINESS", r.threadId);
  assert.ok(byBody(after, "Привет")?.readAt instanceof Date);
  assert.equal(byBody(after, "Сообщение поддержки")?.readAt, null);
});

test("customer inbox: unread badges come from one grouped query and sum across an organization's occasions", async () => {
  const unreadFor = async () =>
    (await getCustomerConversationsForUser(customer)).find((item) => item.key === businessId)?.unreadCount ?? 0;
  const baseline = await unreadFor();

  const threads: string[] = [];
  for (let i = 0; i < 2; i++) {
    const booking = await newBooking();
    const opened = await openBusinessDirectThreadForBooking({ bookingRequestId: booking.id, actorUserId: owner, message: `Новое ${i}` });
    threads.push(opened.threadId);
  }
  assert.equal(await unreadFor(), baseline + 2, "one unread business message per new occasion, summed under the organization");

  const item = (await getCustomerConversationsForUser(customer)).find((row) => row.key === businessId);
  assert.ok(threads.every((id) => item?.threadIds.includes(id)), "list item exposes every thread of the conversation");

  for (const threadId of threads) await markThreadRead({ threadId, readerType: DirectActorType.CUSTOMER });
  assert.equal(await unreadFor(), baseline, "reading the occasions clears exactly those badges");
});

test("business pings: one external 'waiting' notice per thread and window, reset by a business reply, hidden from the bell", async () => {
  const staff = [owner, manager].sort();
  const booking = await newBooking();
  const r = await openBusinessDirectThreadForBooking({ bookingRequestId: booking.id, actorUserId: owner, message: "Привет" });
  const base = { businessId, threadId: r.threadId, threadNumber: r.threadNumber };
  const waiting = (threadId: string) =>
    prisma.notification.findMany({ where: { entityType: "DIRECT_THREAD", entityId: threadId, type: "DIRECT_CLIENT_WAITING" } });
  const ids = [1, 2, 3].map((n) => `m${n}-${sfx}`);

  // 1st customer message: in-app notice + one external ping per team member.
  await notifyBusinessStaffDirectMessage({ ...base, messageId: ids[0] });
  assert.deepEqual((await waiting(r.threadId)).map((n) => n.userId).sort(), staff);

  // 2nd one inside the window: the bell gets its row, no second ping.
  await notifyBusinessStaffDirectMessage({ ...base, messageId: ids[1] });
  assert.equal((await waiting(r.threadId)).length, 2, "throttled: still one ping per member");
  assert.equal(await prisma.notification.count({ where: { type: "DIRECT_NEW_MESSAGE", entityId: { in: ids.slice(0, 2) }, userId: { in: staff } } }), 4,
    "every message still reaches the bell");

  // The business replies: the next customer message opens a new waiting cycle.
  await createDirectMessage({ threadId: r.threadId, senderType: DirectActorType.BUSINESS, senderUserId: owner, body: "Ответ" });
  await notifyBusinessStaffDirectMessage({ ...base, messageId: ids[2] });
  assert.equal((await waiting(r.threadId)).length, 4, "a business reply resets the throttle");

  // Window expiry without a reply also allows a ping; right now it does not.
  assert.equal(await shouldPingStaffAboutThread(owner, r.threadId), false);
  assert.equal(await shouldPingStaffAboutThread(owner, r.threadId, new Date(Date.now() + 31 * 60 * 1000)), true);

  // A new thread already counts as a ping: its first message does not ping twice.
  const second = await openBusinessDirectThreadForBooking({ bookingRequestId: (await newBooking()).id, actorUserId: owner, message: "Новый" });
  await notifyBusinessStaffDirectCreated({ businessId, threadId: second.threadId, threadNumber: second.threadNumber });
  await notifyBusinessStaffDirectMessage({ businessId, threadId: second.threadId, threadNumber: second.threadNumber, messageId: `n1-${sfx}` });
  assert.equal((await waiting(second.threadId)).length, 0);

  // The external-only notice never shows in the bell or in the unread count.
  const feed = await getUnifiedNotificationFeed(owner, 100, 0, "business");
  assert.ok(!feed.some((n) => n.type === "DIRECT_CLIENT_WAITING"), "hidden from the business feed");
  assert.equal(await getUnreadCount(owner, "business"), feed.filter((n) => !n.readAt).length, "and from the unread badge");

  // Local/CI has no e-mail provider or Telegram link: nothing real is sent, every channel is SKIPPED.
  await waitForDeliveriesToSettle([r.threadId, second.threadId, ...ids, `n1-${sfx}`]);
  const deliveries = await prisma.notificationDelivery.findMany({ where: { notification: { type: "DIRECT_CLIENT_WAITING", entityId: r.threadId } } });
  assert.ok(deliveries.length > 0 && deliveries.every((d) => d.status === "SKIPPED"), "no real delivery attempted here");
});

test("business waiting pings are atomic under overlapping customer messages", async () => {
  const booking = await newBooking();
  const thread = await openBusinessDirectThreadForBooking({
    bookingRequestId: booking.id, actorUserId: owner, message: "Конкурентные сообщения",
  });
  const messages = Array.from({ length: 8 }, (_, i) => `concurrent-${sfx}-${i}`);
  await Promise.all(messages.map((messageId) => notifyBusinessStaffDirectMessage({
    businessId, threadId: thread.threadId, threadNumber: thread.threadNumber, messageId,
  })));

  const waiting = await prisma.notification.findMany({
    where: { type: "DIRECT_CLIENT_WAITING", entityType: "DIRECT_THREAD", entityId: thread.threadId },
    select: { userId: true },
  });
  assert.deepEqual(waiting.map((n) => n.userId).sort(), [owner, manager].sort(),
    "one durable waiting notification for each staff member, regardless of overlap");

  const bellCount = await prisma.notification.count({
    where: { type: "DIRECT_NEW_MESSAGE", entityId: { in: messages }, userId: { in: [owner, manager] } },
  });
  assert.equal(bellCount, messages.length * 2, "every customer message still reaches the business bell");
});

test("created and waiting external Direct pings share one claim across concurrent workers", async () => {
  const staff = [owner, manager].sort();
  for (const ordering of ["parallel", "waiting-first", "created-first"] as const) {
    const booking = await newBooking();
    const thread = await openBusinessDirectThreadForBooking({
      bookingRequestId: booking.id, actorUserId: owner, message: `Race ${ordering}`,
    });
    const params = { businessId, threadId: thread.threadId, threadNumber: thread.threadNumber };
    const messageId = `race-${ordering}-${sfx}`;
    const created = () => notifyBusinessStaffDirectCreated(params);
    const waiting = () => notifyBusinessStaffDirectMessage({ ...params, messageId });
    if (ordering === "parallel") {
      // Overlap initial creation and one new message. Same-message retries are
      // sequential: bell dedup is a separate concern, not this external-ping race.
      await Promise.all([created(), waiting(), created()]);
      await waiting();
    } else if (ordering === "waiting-first") {
      await waiting();
      await created();
    } else {
      await created();
      await waiting();
    }
    const notices = await prisma.notification.findMany({
      where: { userId: { in: staff }, entityType: "DIRECT_THREAD", entityId: thread.threadId,
        type: { in: ["DIRECT_THREAD_CREATED", "DIRECT_CLIENT_WAITING"] } },
      select: { userId: true, type: true },
    });
    assert.deepEqual(notices.map(n => n.userId).sort(), staff,
      `exactly one external notice per recipient for ${ordering}`);
    if (ordering === "waiting-first") {
      assert.ok(notices.every(n => n.type === "DIRECT_CLIENT_WAITING"),
        "late thread creation must not issue duplicate external delivery");
    }
    const bellCount = await prisma.notification.count({
      where: { type: "DIRECT_NEW_MESSAGE", entityId: messageId, userId: { in: staff } },
    });
    assert.equal(bellCount, 2, `new message reaches each business bell for ${ordering}`);
    // Let async delivery rows settle before the shared PostgreSQL fixture teardown.
    await waitForDeliveriesToSettle([thread.threadId, messageId]);
  }
});