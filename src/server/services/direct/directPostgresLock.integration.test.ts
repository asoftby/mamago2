/** Real Direct services against a disposable PostgreSQL database. No external sends. */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, test } from "node:test";
import pg from "pg";
import prisma from "@/lib/prisma";
import { createDirectMessage, DirectMessageError } from "./directMessage.service";
import { blockThread } from "./directThread.service";
import type { DirectActorType, DirectThreadStatus } from "@prisma/client";

const connectionString = process.env.DATABASE_URL;
assert.ok(connectionString && ["localhost", "127.0.0.1"].includes(new URL(connectionString).hostname), "Disposable local PostgreSQL required");
const control = new pg.Client({ connectionString });
let ownerId = "";
let customerId = "";
let businessId = "";
let controlPid = 0;
const threadIds: string[] = [];

before(async () => {
  await control.connect();
  controlPid = (await control.query("SELECT pg_backend_pid() AS pid")).rows[0].pid;
  const suffix = randomUUID();
  ownerId = (await prisma.user.create({ data: { email: "direct-owner-" + suffix + "@example.test" } })).id;
  customerId = (await prisma.user.create({ data: { email: "direct-customer-" + suffix + "@example.test" } })).id;
  businessId = (await prisma.business.create({ data: { name: "Synthetic Direct security", ownerUserId: ownerId } })).id;
});

after(async () => {
  await control.query("ROLLBACK");
  await control.end();
  await prisma.directThread.deleteMany({ where: { id: { in: threadIds } } });
  await prisma.bookingRequest.deleteMany({ where: { businessId } });
  if (businessId) await prisma.business.delete({ where: { id: businessId } });
  await prisma.user.deleteMany({ where: { id: { in: [ownerId, customerId] } } });
  await prisma.$disconnect();
});

async function fixture() {
  const booking = await prisma.bookingRequest.create({ data: {
    businessId, userId: customerId, publicationType: "OFFER", status: "NEW",
    customerName: "Synthetic", customerPhone: "+375291112233",
    startsAt: new Date(Date.now() + 86_400_000), endsAt: new Date(Date.now() + 90_000_000),
  } });
  const thread = await prisma.directThread.create({ data: { businessId, customerUserId: customerId, publicationType: "OFFER", bookingRequestId: booking.id } });
  threadIds.push(thread.id);
  return { booking, thread };
}

function send(threadId: string, senderType: DirectActorType) {
  return createDirectMessage({ threadId, senderType, senderUserId: senderType === "SYSTEM" ? null : senderType === "CUSTOMER" ? customerId : ownerId, body: "Synthetic reply" });
}

async function waiting(fragment: string) {
  const until = Date.now() + 3000;
  while (Date.now() < until) {
    await control.query("SELECT pg_stat_clear_snapshot()");
    const result = await control.query("SELECT 1 FROM pg_stat_activity WHERE datname=current_database() AND pid<>$1 AND wait_event_type='Lock' AND query LIKE $2", [controlPid, "%" + fragment + "%"]);
    if (result.rowCount) return;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error("Expected real service lock wait: " + fragment);
}

function deadline<T>(promise: Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  return Promise.race([promise, new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error("Potential Direct lock inversion")), 3000); })]).finally(() => clearTimeout(timer));
}

for (const senderType of ["CUSTOMER", "BUSINESS", "ADMIN", "SYSTEM"] as const) {
  for (const target of ["BLOCKED", "ARCHIVED"] as const) {
    test(`${senderType} rechecks ${target} after waiting for the real DirectThread lock`, async () => {
      const { thread } = await fixture();
      await control.query("BEGIN");
      await control.query('SELECT id FROM "DirectThread" WHERE id=$1 FOR UPDATE', [thread.id]);
      const moderate = target === "BLOCKED"
        ? blockThread({ threadId: thread.id, blockedByUserId: ownerId, actorRole: "ADMIN", reason: "Synthetic race" })
        : prisma.directThread.update({ where: { id: thread.id }, data: { status: target as DirectThreadStatus } });
      const moderation = moderate.then(() => null, (error: unknown) => error);
      let sending: Promise<unknown> | undefined;
      try {
        // Ensure moderation is queued first while the sender's fast read still sees OPEN.
        await waiting('UPDATE "public"."DirectThread"');
        sending = send(thread.id, senderType).then(() => null, (error: unknown) => error);
        await waiting('FOR UPDATE');
        await control.query("COMMIT");
        assert.equal(await deadline(moderation), null);
        assert.ok(await deadline(sending) instanceof DirectMessageError);
        assert.equal(await prisma.directMessage.count({ where: { threadId: thread.id } }), 0);
        assert.equal((await prisma.directThread.findUniqueOrThrow({ where: { id: thread.id } })).status, target);
      } finally {
        await control.query("ROLLBACK");
        await Promise.allSettled([moderation, ...(sending ? [sending] : [])]);
      }
    });
  }
}

test("BUSINESS waits on booking before thread so moderator can block without deadlock", async () => {
  const { booking, thread } = await fixture();
  await control.query("BEGIN");
  await control.query('SELECT id FROM "BookingRequest" WHERE id=$1 FOR UPDATE', [booking.id]);
  const sending = send(thread.id, "BUSINESS").then(() => null, (error: unknown) => error);
  try {
    await waiting('FOR SHARE');
    await deadline(blockThread({ threadId: thread.id, blockedByUserId: ownerId, actorRole: "ADMIN" }));
    await control.query('UPDATE "BookingRequest" SET status=\'CANCELLED\' WHERE id=$1', [booking.id]);
    await control.query("COMMIT");
    assert.ok(await deadline(sending) instanceof DirectMessageError);
    assert.equal(await prisma.directMessage.count({ where: { threadId: thread.id } }), 0);
  } finally { await control.query("ROLLBACK"); await sending; }
});

test("OPEN permits all existing sender types and returns persisted messages", async () => {
  const { thread } = await fixture();
  for (const senderType of ["CUSTOMER", "BUSINESS", "ADMIN", "SYSTEM"] as const) {
    const message = await send(thread.id, senderType);
    assert.equal(message.threadId, thread.id);
    assert.equal(message.senderType, senderType);
  }
  assert.equal(await prisma.directMessage.count({ where: { threadId: thread.id } }), 4);
});
