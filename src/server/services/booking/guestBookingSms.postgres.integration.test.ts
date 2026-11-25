import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, test } from "node:test";
import { BookingStatus, PrismaClient } from "@prisma/client";
import { updateBookingStatus } from "./bookingQuery.service";
import { dispatchGuestBookingSms } from "./guestBookingSms.service";
import { SmsByDeliveryError } from "@/lib/sms/smsByResponse";
import type { SmsByResponse } from "@/lib/sms/smsByResponse";

const database = new URL(process.env.DATABASE_URL ?? "http://invalid");
assert.ok(["localhost", "127.0.0.1"].includes(database.hostname), "Disposable local PostgreSQL required");
const db = new PrismaClient();
const suffix = randomUUID();
let ownerId = "";
let businessId = "";
const customerIds: string[] = [];

async function fixture() {
  if (businessId) return;
  const owner = await db.user.create({ data: { email: "sms-owner-" + suffix + "@example.test" } });
  ownerId = owner.id;
  businessId = (await db.business.create({ data: { name: "Synthetic SMS business", ownerUserId: ownerId } })).id;
}

async function booking(status: BookingStatus = "NEW", userId?: string) {
  await fixture();
  return db.bookingRequest.create({ data: {
    businessId, publicationType: "OFFER", customerName: "Synthetic guest",
    customerPhone: "+375291112233", status, userId,
    startsAt: new Date(Date.now() + 86_400_000), endsAt: new Date(Date.now() + 90_000_000),
  } });
}

async function decide(id: string, status: BookingStatus, reason?: string) {
  return updateBookingStatus(id, businessId, status, { actorId: ownerId, actorRole: "USER", reason });
}

const accepted = (): Promise<SmsByResponse> => Promise.resolve({ sms_id: "1001", status: "NEW", parts: 1 });
const dueClock = () => new Date(Date.now() + 1000);

async function delivery(bookingId: string) {
  return db.bookingSmsDelivery.findFirstOrThrow({ where: { bookingId }, include: { attempts: { orderBy: { number: "asc" } } } });
}

after(async () => {
  if (businessId) {
    await db.bookingRequest.deleteMany({ where: { businessId } });
    await db.business.delete({ where: { id: businessId } });
  }
  await db.user.deleteMany({ where: { id: { in: [ownerId, ...customerIds] } } });
  await db.$disconnect();
});

test("one business decision queues atomically and concurrent dispatchers buy one SMS", async () => {
  const row = await booking();
  const decisions = await Promise.allSettled([decide(row.id, "CONFIRMED"), decide(row.id, "CONFIRMED")]);
  assert.equal(decisions.filter((result) => result.status === "fulfilled").length, 1);
  assert.equal(await db.bookingSmsDelivery.count({ where: { bookingId: row.id } }), 1);
  assert.equal(await db.bookingActivity.count({ where: { bookingId: row.id, type: "STATUS_CHANGED" } }), 1);
  let calls = 0;
  const send = async (params: { phoneDigits: string; message: string }) => {
    calls += 1;
    assert.equal(params.phoneDigits, "375291112233");
    assert.ok(params.message.includes("Запись подтверждена"));
    await new Promise<void>((resolve) => setImmediate(resolve));
    return accepted();
  };
  await Promise.all([
    dispatchGuestBookingSms({ bookingId: row.id }, { send, now: dueClock }),
    dispatchGuestBookingSms({ bookingId: row.id }, { send, now: dueClock }),
  ]);
  await dispatchGuestBookingSms({ bookingId: row.id }, { send, now: dueClock });
  assert.equal(calls, 1);
  const journal = await delivery(row.id);
  assert.equal(journal.status, "ACCEPTED");
  assert.equal(journal.providerStatus, "NEW", "Provider acceptance is not handset delivery");
  assert.equal(journal.estimatedParts, 1);
  assert.equal(journal.providerParts, 1);
  assert.equal(journal.attempts.length, 1);
  assert.equal(journal.attempts[0].status, "ACCEPTED");
  const serialized = JSON.stringify(journal);
  assert.equal(serialized.includes("375291112233"), false);
  assert.equal(serialized.includes("Запись подтверждена"), false);
});

test("rejection and cancellation transmit the explanation and suppress superseded confirmation", async () => {
  const rejected = await booking();
  await decide(rejected.id, "REJECTED", "Другая причина: Площадка недоступна");
  const messages: string[] = [];
  const send = async (params: { message: string }) => { messages.push(params.message); return accepted(); };
  await dispatchGuestBookingSms({ bookingId: rejected.id }, { send, now: dueClock });
  assert.equal(messages.length, 1);
  assert.ok(messages[0].includes("Отказ. Площадка недоступна"));
  await assert.rejects(decide(rejected.id, "REJECTED", "Другая причина: Повтор"));
  assert.equal(await db.bookingSmsDelivery.count({ where: { bookingId: rejected.id } }), 1);

  const cancelled = await booking();
  await decide(cancelled.id, "CONFIRMED");
  await decide(cancelled.id, "CANCELLED", "Изменилось расписание");
  messages.length = 0;
  await dispatchGuestBookingSms({ bookingId: cancelled.id }, { send, now: dueClock });
  assert.equal(messages.length, 1);
  assert.ok(messages[0].includes("Запись отменена. Изменилось расписание"));
  const queue = await db.bookingSmsDelivery.findMany({ where: { bookingId: cancelled.id }, orderBy: { createdAt: "asc" } });
  assert.equal(queue.find((entry) => entry.decisionStatus === "CONFIRMED")?.status, "SKIPPED");
  assert.equal(queue.find((entry) => entry.decisionStatus === "CANCELLED")?.status, "ACCEPTED");
});

test("explicit provider rejection preserves the business decision and retries once due", async () => {
  const row = await booking();
  await decide(row.id, "REJECTED", "Нет свободных мест");
  const result = await dispatchGuestBookingSms({ bookingId: row.id }, {
    now: dueClock, send: async () => { throw new SmsByDeliveryError("PROVIDER_REJECTED", 200); },
  });
  assert.equal(result.failed, 1);
  assert.equal((await db.bookingRequest.findUniqueOrThrow({ where: { id: row.id } })).status, "REJECTED");
  let journal = await delivery(row.id);
  assert.equal(journal.status, "FAILED");
  let calls = 0;
  const send = async () => { calls += 1; return accepted(); };
  await dispatchGuestBookingSms({ bookingId: row.id }, { send, now: dueClock });
  assert.equal(calls, 0);
  await dispatchGuestBookingSms({ bookingId: row.id }, { send, now: () => new Date(journal.nextAttemptAt.getTime() + 1) });
  journal = await delivery(row.id);
  assert.equal(calls, 1);
  assert.equal(journal.status, "ACCEPTED");
  assert.equal(journal.errorCode, null);
  assert.equal(journal.attempts.length, 2);
  assert.equal(journal.attempts[0].errorCode, "PROVIDER_REJECTED");
});

test("known failures exhaust a bounded retry budget", async () => {
  const row = await booking();
  await decide(row.id, "CONFIRMED");
  let calls = 0;
  const send = async () => { calls += 1; throw new SmsByDeliveryError("NOT_CONFIGURED"); };
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const journal = await delivery(row.id);
    await dispatchGuestBookingSms({ bookingId: row.id }, { send, now: () => new Date(journal.nextAttemptAt.getTime() + 1) });
  }
  const journal = await delivery(row.id);
  assert.equal(journal.status, "EXHAUSTED");
  assert.equal(journal.attemptCount, 3);
  assert.equal(journal.attempts.length, 3);
  await dispatchGuestBookingSms({ bookingId: row.id }, { send, now: () => new Date(Date.now() + 86_400_000) });
  assert.equal(calls, 3);
});

test("ambiguous network/HTTP/response outcomes are quarantined without a second SMS", async () => {
  for (const code of ["NETWORK_ERROR", "HTTP_ERROR", "INVALID_RESPONSE"] as const) {
    const row = await booking();
    await decide(row.id, "CONFIRMED");
    let calls = 0;
    const send = async () => { calls += 1; throw new SmsByDeliveryError(code); };
    await dispatchGuestBookingSms({ bookingId: row.id }, { send, now: dueClock });
    await dispatchGuestBookingSms({ bookingId: row.id }, { send, now: () => new Date(Date.now() + 86_400_000) });
    const journal = await delivery(row.id);
    assert.equal(journal.status, "UNCERTAIN");
    assert.equal(journal.errorCode, code);
    assert.equal(calls, 1);
  }
});

test("interrupted workers and anonymized recipients never trigger an unsafe resend", async () => {
  const row = await booking();
  await decide(row.id, "CONFIRMED");
  const journal = await delivery(row.id);
  await db.bookingSmsDelivery.update({ where: { id: journal.id }, data: {
    status: "SENDING", attemptCount: 1, leaseUntil: new Date(Date.now() - 1000),
    attempts: { create: { number: 1, status: "SENDING" } },
  } });
  const send = async () => { assert.fail("Must not send after an interrupted attempt"); };
  await dispatchGuestBookingSms({ bookingId: row.id }, { send, now: dueClock });
  assert.equal((await delivery(row.id)).status, "UNCERTAIN");
  assert.equal((await delivery(row.id)).attempts[0].errorCode, "WORKER_INTERRUPTED");

  const deleted = await booking();
  await decide(deleted.id, "REJECTED", "Нет свободных мест");
  await db.bookingRequest.update({ where: { id: deleted.id }, data: { customerPhone: "", customerName: "Удалённый пользователь" } });
  await dispatchGuestBookingSms({ bookingId: deleted.id }, { send, now: dueClock });
  assert.equal((await delivery(deleted.id)).status, "SKIPPED");
  assert.equal((await delivery(deleted.id)).errorCode, "RECIPIENT_UNAVAILABLE");
});

test("registered users retain existing channels and never create guest SMS deliveries", async () => {
  const user = await db.user.create({ data: { email: "sms-customer-" + suffix + "@example.test" } });
  customerIds.push(user.id);
  for (const type of ["BOOKING_CONFIRMED", "BOOKING_CANCELLED"] as const) {
    await db.userNotificationPreference.create({ data: { userId: user.id, notificationType: type, emailEnabled: false, telegramEnabled: false } });
  }
  const row = await booking("NEW", user.id);
  await decide(row.id, "CONFIRMED");
  await decide(row.id, "CANCELLED", "Мероприятие отменено");
  const rejected = await booking("NEW", user.id);
  await decide(rejected.id, "REJECTED", "Нет свободных мест");
  assert.equal(await db.bookingSmsDelivery.count({ where: { bookingId: { in: [row.id, rejected.id] } } }), 0);
});

test("existing SMS.by integration is reused with a mocked network and no PII in logs", async () => {
  const row = await booking();
  await decide(row.id, "CONFIRMED");
  const originalFetch = globalThis.fetch;
  const originalToken = process.env.SMS_BY_TOKEN;
  const originalBase = process.env.SMS_BY_BASE_URL;
  const originalInfo = console.info;
  const originalError = console.error;
  let reject = false;
  const logs: string[] = [];
  let calls = 0;
  process.env.SMS_BY_TOKEN = "synthetic-sms-token";
  process.env.SMS_BY_BASE_URL = "https://sms-provider.invalid";
  console.info = (...args) => { logs.push(JSON.stringify(args)); };
  console.error = (...args) => { logs.push(JSON.stringify(args)); };
  globalThis.fetch = async (input, init) => {
    calls += 1;
    assert.equal(String(input), "https://sms-provider.invalid/api/v1/sendQuickSms");
    const body = new URLSearchParams(String(init?.body));
    assert.deepEqual([...body.keys()].sort(), ["message", "phone", "token"]);
    assert.equal(body.get("phone"), "375291112233");
    return new Response(JSON.stringify(reject
      ? { status: "ERROR", error: "sensitive-provider-body-375291112233" }
      : { sms_id: 2002, status: "NEW", parts: 1 }), { status: 200 });
  };
  try {
    await dispatchGuestBookingSms({ bookingId: row.id }, { now: dueClock });
    assert.equal(calls, 1);
    assert.equal((await delivery(row.id)).providerMessageId, "2002");
    const failed = await booking();
    await decide(failed.id, "REJECTED", "Нет свободных мест");
    reject = true;
    await dispatchGuestBookingSms({ bookingId: failed.id }, { now: dueClock });
    assert.equal(calls, 2);
    assert.equal((await delivery(failed.id)).status, "FAILED");
    assert.equal(JSON.stringify(await delivery(failed.id)).includes("sensitive-provider-body"), false);
    assert.equal(logs.join("").includes("375291112233"), false);
    assert.equal(logs.join("").includes("synthetic-sms-token"), false);
    assert.equal(logs.join("").includes("Запись подтверждена"), false);
  } finally {
    globalThis.fetch = originalFetch;
    console.info = originalInfo;
    console.error = originalError;
    if (originalToken === undefined) delete process.env.SMS_BY_TOKEN;
    else process.env.SMS_BY_TOKEN = originalToken;
    if (originalBase === undefined) delete process.env.SMS_BY_BASE_URL;
    else process.env.SMS_BY_BASE_URL = originalBase;
  }
});


test("database failure after provider acceptance cannot cause an automatic duplicate", async () => {
  const row = await booking();
  await decide(row.id, "CONFIRMED");
  const trigger = "test_guest_sms_journal_" + randomUUID().replaceAll("-", "");
  assert.match(trigger, /^[a-z0-9_]+$/);
  assert.match(row.id, /^[a-z0-9]+$/);
  // Both interpolated identifiers are generated here; the trigger only affects this fixture.
  await db.$executeRawUnsafe(`
    CREATE FUNCTION "${trigger}"() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN
      IF NEW."bookingId" = TG_ARGV[0] AND NEW."status" = 'ACCEPTED' THEN
        RAISE EXCEPTION 'synthetic journal failure';
      END IF;
      RETURN NEW;
    END; $$
  `);
  await db.$executeRawUnsafe(`CREATE TRIGGER "${trigger}" BEFORE UPDATE ON "BookingSmsDelivery" FOR EACH ROW EXECUTE FUNCTION "${trigger}"('${row.id}')`);
  let calls = 0;
  const send = async () => { calls += 1; return accepted(); };
  try {
    await assert.rejects(dispatchGuestBookingSms({ bookingId: row.id }, { send, now: dueClock }), /acceptance journal update failed/);
    assert.equal((await db.bookingRequest.findUniqueOrThrow({ where: { id: row.id } })).status, "CONFIRMED");
    assert.equal((await delivery(row.id)).status, "SENDING");
  } finally {
    await db.$executeRawUnsafe('DROP TRIGGER "' + trigger + '" ON "BookingSmsDelivery"');
    await db.$executeRawUnsafe('DROP FUNCTION "' + trigger + '"()');
  }
  await dispatchGuestBookingSms({ bookingId: row.id }, { send, now: () => new Date(Date.now() + 120_000) });
  assert.equal(calls, 1);
  assert.equal((await delivery(row.id)).status, "UNCERTAIN");
});


test("legacy free-text visit times cannot create an unbounded paid SMS", async () => {
  const row = await booking();
  await db.bookingRequest.update({ where: { id: row.id }, data: {
    startsAt: null, endsAt: null, requestedDate: new Date("2027-01-15"), requestedTime: "legacy-time-".repeat(500),
  } });
  await decide(row.id, "CONFIRMED");
  let message = "";
  await dispatchGuestBookingSms({ bookingId: row.id }, {
    now: dueClock, send: async (params) => { message = params.message; return accepted(); },
  });
  assert.ok(message.includes("15.01"));
  assert.equal(message.includes("legacy-time"), false);
  assert.ok(message.length <= 70);
  assert.equal((await delivery(row.id)).estimatedParts, 1);
});
