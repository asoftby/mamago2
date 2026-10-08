/**
 * Integration test against a real (scratch) Postgres: DATABASE_URL must point
 * to a database with all migrations applied. Creates and removes its own rows.
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test, { after, before } from "node:test";
import { PrismaClient } from "@prisma/client";
import { CAPTURE_LIMITS } from "./captureLimits";
import { CAPTURE_REPLIES } from "./captureReplies";
import { createInboxIntake, type InboxIntakeDeps } from "./inboxIntake.service";
import { createNotImplementedInboxProcessor, type InboxProcessor } from "./inboxProcessor";
import type { ParsedCapture } from "./telegramUpdateParser";

// Parallel receipts wait on each other's advisory lock while holding a pooled
// connection, so the test client needs a pool larger than the parallelism.
function withPool(url: string, size: number): string {
  const parsed = new URL(url);
  parsed.searchParams.set("connection_limit", String(size));
  return parsed.toString();
}

const db = new PrismaClient({ datasources: { db: { url: withPool(process.env.DATABASE_URL ?? "", 30) } } });
const runId = randomUUID().slice(0, 8);
const userIds: string[] = [];
let updateCounter = 1_000_000 + Math.floor(Math.random() * 1_000_000);

async function makeUser(label: string): Promise<{ userId: string }> {
  const id = `intake-${runId}-${label}`;
  await db.user.create({ data: { id, email: `${id}@example.test` } });
  userIds.push(id);
  return { userId: id };
}

type Harness = ReturnType<typeof makeIntake>;

function makeIntake(overrides: Partial<InboxIntakeDeps> = {}) {
  const clock = { t: Date.now() };
  const replies: string[] = [];
  const typing: number[] = [];
  const processed: string[] = [];
  const processor: InboxProcessor = {
    async process(id) {
      processed.push(id);
      await createNotImplementedInboxProcessor(db, () => new Date(clock.t)).process(id);
    },
  };
  const intake = createInboxIntake({
    db,
    notifier: {
      async reply(_chatId, text) {
        replies.push(text);
      },
      async typing(chatId) {
        typing.push(chatId);
      },
    },
    processor,
    now: () => new Date(clock.t),
    sleep: async (ms) => {
      clock.t += ms;
    },
    jitter: () => 0,
    ...overrides,
  });
  return { intake, clock, replies, typing, processed };
}

function capture(extra: Partial<ParsedCapture> = {}): ParsedCapture {
  updateCounter += 1;
  return {
    kind: "capture",
    updateId: updateCounter,
    chatId: 4242,
    fromUserId: 4242,
    messageId: updateCounter,
    partKind: "TEXT",
    text: "Экскурсия 9 октября",
    fileId: null,
    photoTooLarge: false,
    mediaGroupId: null,
    sourceKind: "TEXT",
    anchorAt: new Date("2026-10-01T10:00:00Z"),
    anchorIsForward: false,
    ...extra,
  };
}

function photo(group: string, extra: Partial<ParsedCapture> = {}): ParsedCapture {
  return capture({
    partKind: "PHOTO",
    sourceKind: "PHOTO",
    text: null,
    fileId: `file-${randomUUID()}`,
    mediaGroupId: group,
    ...extra,
  });
}

async function countItems(userId: string): Promise<number> {
  return db.inboxItem.count({ where: { userId } });
}

before(async () => {
  await db.$connect();
});

after(async () => {
  await db.inboxItem.deleteMany({ where: { userId: { in: userIds } } });
  await db.user.deleteMany({ where: { id: { in: userIds } } });
  await db.$disconnect();
});

test("single message: stored once; redelivery leaves one part and no orphan item", async () => {
  const owner = await makeUser("single-dup");
  const h: Harness = makeIntake();
  const cap = capture();

  const first = await h.intake.receive(owner, "DEV", cap);
  assert.equal(first.outcome.status, "stored");
  const second = await h.intake.receive(owner, "DEV", cap);
  assert.equal(second.outcome.status, "duplicate");
  assert.equal(second.afterResponse, null);

  assert.equal(await countItems(owner.userId), 1);
  assert.equal(await db.inboxItemPart.count({ where: { inboxItem: { userId: owner.userId } } }), 1);

  const item = await db.inboxItem.findFirstOrThrow({ where: { userId: owner.userId }, include: { parts: true } });
  assert.equal(item.status, "RECEIVED");
  assert.equal(item.environment, "DEV");
  assert.equal(item.telegramChatId, BigInt(4242));
  assert.equal(item.anchorIsForward, false);
  assert.equal(item.sourceKind, "TEXT");
  assert.equal(item.parts[0]!.text, "Экскурсия 9 октября");
  assert.equal(item.purgeAfter.getTime() - item.createdAt.getTime(), CAPTURE_LIMITS.purgeAfterMs);
});

test("concurrent redelivery of a single update still yields one item", async () => {
  const owner = await makeUser("single-race");
  const h = makeIntake();
  const cap = capture();
  const results = await Promise.all(Array.from({ length: 5 }, () => h.intake.receive(owner, "DEV", cap)));
  assert.equal(results.filter((r) => r.outcome.status === "stored").length, 1);
  assert.equal(results.filter((r) => r.outcome.status === "duplicate").length, 4);
  assert.equal(await countItems(owner.userId), 1);
  assert.equal(await db.inboxItemPart.count({ where: { inboxItem: { userId: owner.userId } } }), 1);
});

test("same update id in another environment is a different receipt", async () => {
  const owner = await makeUser("env");
  const h = makeIntake();
  const cap = capture();
  assert.equal((await h.intake.receive(owner, "DEV", cap)).outcome.status, "stored");
  assert.equal((await h.intake.receive(owner, "PROD", cap)).outcome.status, "stored");
  assert.equal(await countItems(owner.userId), 2);
});

test("album with the same media_group_id in another environment is a separate item", async () => {
  const owner = await makeUser("album-env");
  const h = makeIntake();
  const dev = await h.intake.receive(owner, "DEV", photo("grp-env"));
  const prod = await h.intake.receive(owner, "PROD", photo("grp-env"));
  const devId = dev.outcome.status === "stored" ? dev.outcome.inboxItemId : "";
  const prodId = prod.outcome.status === "stored" ? prod.outcome.inboxItemId : "";
  assert.ok(devId && prodId);
  assert.notEqual(devId, prodId);
  const items = await db.inboxItem.findMany({ where: { userId: owner.userId }, include: { parts: true } });
  assert.equal(items.length, 2);
  assert.ok(items.every((item) => item.parts.length === 1 && item.ruleCodes.length === 0));
});

test("album: redelivery of a part creates no extra part", async () => {
  const owner = await makeUser("album-dup");
  const h = makeIntake();
  const part = photo("grp-dup");
  assert.equal((await h.intake.receive(owner, "DEV", part)).outcome.status, "stored");
  assert.equal((await h.intake.receive(owner, "DEV", part)).outcome.status, "duplicate");
  assert.equal(await countItems(owner.userId), 1);
  assert.equal(await db.inboxItemPart.count({ where: { inboxItem: { userId: owner.userId } } }), 1);
});

test("album: three parts arriving in parallel make one item with three parts", async () => {
  const owner = await makeUser("album-parallel");
  const h = makeIntake();
  const parts = [photo("grp-par"), photo("grp-par"), photo("grp-par")];
  const results = await Promise.all(parts.map((part) => h.intake.receive(owner, "DEV", part)));
  assert.ok(results.every((r) => r.outcome.status === "stored"));
  const ids = new Set(results.map((r) => (r.outcome.status === "stored" ? r.outcome.inboxItemId : "")));
  assert.equal(ids.size, 1);
  const item = await db.inboxItem.findFirstOrThrow({ where: { userId: owner.userId }, include: { parts: true } });
  assert.equal(item.parts.length, 3);
  assert.equal(await countItems(owner.userId), 1);
  assert.ok(item.debounceUntil.getTime() > h.clock.t);
});

test("CAS claim: parallel attempts give exactly one winner, and none before the debounce", async () => {
  const owner = await makeUser("cas");
  const h = makeIntake();
  const result = await h.intake.receive(owner, "DEV", photo("grp-cas"));
  assert.equal(result.outcome.status, "stored");
  const id = result.outcome.status === "stored" ? result.outcome.inboxItemId : "";

  assert.equal(await h.intake.claim(id), false, "debounce has not elapsed yet");
  h.clock.t += CAPTURE_LIMITS.albumDebounceMs + 10;
  const claims = await Promise.all(Array.from({ length: 8 }, () => h.intake.claim(id)));
  assert.equal(claims.filter(Boolean).length, 1);
  const item = await db.inboxItem.findUniqueOrThrow({ where: { id } });
  assert.equal(item.status, "PROCESSING");
});

test("late album part after the claim starts a new item flagged ALBUM_LATE_PART", async () => {
  const owner = await makeUser("late");
  const h = makeIntake();
  const first = await h.intake.receive(owner, "DEV", photo("grp-late"));
  assert.equal(first.outcome.status, "stored");
  h.clock.t += CAPTURE_LIMITS.albumDebounceMs + 10;
  const firstId = first.outcome.status === "stored" ? first.outcome.inboxItemId : "";
  assert.equal(await h.intake.claim(firstId), true);

  const late = await h.intake.receive(owner, "DEV", photo("grp-late"));
  assert.equal(late.outcome.status, "stored");
  const lateId = late.outcome.status === "stored" ? late.outcome.inboxItemId : "";
  assert.notEqual(lateId, firstId);
  const lateItem = await db.inboxItem.findUniqueOrThrow({ where: { id: lateId } });
  assert.deepEqual(lateItem.ruleCodes, ["ALBUM_LATE_PART"]);
  assert.equal(lateItem.status, "RECEIVED");
  const firstItem = await db.inboxItem.findUniqueOrThrow({ where: { id: firstId } });
  assert.deepEqual(firstItem.ruleCodes, []);
});

test("rate limit: 30 items in 24h blocks the next one; older items do not count", async () => {
  const owner = await makeUser("rate");
  const h = makeIntake();
  const base = {
    userId: owner.userId,
    environment: "DEV" as const,
    telegramChatId: BigInt(1),
    sourceKind: "TEXT" as const,
    anchorAt: new Date(),
    anchorIsForward: false,
    debounceUntil: new Date(),
    purgeAfter: new Date(Date.now() + 86_400_000),
  };
  await db.inboxItem.createMany({
    data: Array.from({ length: 30 }, () => ({ ...base, createdAt: new Date(h.clock.t - 60_000) })),
  });

  const blocked = await h.intake.receive(owner, "DEV", capture());
  assert.deepEqual(blocked.outcome, { status: "rejected", reason: "RATE_LIMITED" });
  assert.equal(blocked.afterResponse, null);
  assert.deepEqual(h.replies, [CAPTURE_REPLIES.rateLimited]);
  assert.equal(await countItems(owner.userId), 30);

  const albumBlocked = await h.intake.receive(owner, "DEV", photo("grp-rate"));
  assert.deepEqual(albumBlocked.outcome, { status: "rejected", reason: "RATE_LIMITED" });
  assert.equal(await countItems(owner.userId), 30);

  // Items older than the rolling window stop counting.
  h.clock.t += CAPTURE_LIMITS.rateWindowMs;
  assert.equal((await h.intake.receive(owner, "DEV", capture())).outcome.status, "stored");
});

async function seedItems(userId: string, count: number, createdAt: Date): Promise<void> {
  await db.inboxItem.createMany({
    data: Array.from({ length: count }, () => ({
      userId,
      environment: "DEV" as const,
      telegramChatId: BigInt(1),
      sourceKind: "TEXT" as const,
      anchorAt: new Date(),
      anchorIsForward: false,
      debounceUntil: new Date(),
      purgeAfter: new Date(Date.now() + 86_400_000),
      createdAt,
    })),
  });
}

test("rate limit is atomic: parallel updates at count=29 create exactly one item", async () => {
  const owner = await makeUser("rate-atomic");
  const h = makeIntake();
  await seedItems(owner.userId, 29, new Date(h.clock.t - 60_000));

  const results = await Promise.all(Array.from({ length: 8 }, () => h.intake.receive(owner, "DEV", capture())));
  const stored = results.filter((r) => r.outcome.status === "stored").length;
  const rejected = results.filter(
    (r) => r.outcome.status === "rejected" && r.outcome.reason === "RATE_LIMITED",
  ).length;
  assert.equal(stored, 1);
  assert.equal(rejected, 7);
  assert.equal(await countItems(owner.userId), 30);
  assert.deepEqual(h.replies, Array(7).fill(CAPTURE_REPLIES.rateLimited), "refusals are sent after the commit");
});

test("rate limit stays atomic when an album and singles of one user race at count=29", async () => {
  const owner = await makeUser("rate-mixed");
  const h = makeIntake();
  await seedItems(owner.userId, 29, new Date(h.clock.t - 60_000));

  const album = [photo("grp-mixed"), photo("grp-mixed"), photo("grp-mixed")];
  const singles = [capture(), capture(), capture()];
  const results = await Promise.all([...album, ...singles].map((c) => h.intake.receive(owner, "DEV", c)));
  assert.ok(results.every((r) => ["stored", "rejected", "truncated"].includes(r.outcome.status)));
  assert.equal(await countItems(owner.userId), 30);
});

test("an album and single updates of one user in parallel finish without deadlock", async () => {
  const owner = await makeUser("no-deadlock");
  const h = makeIntake();
  const batch = [
    photo("grp-dl"),
    capture(),
    photo("grp-dl"),
    capture(),
    photo("grp-dl"),
    capture(),
    capture(),
  ];
  const results = await Promise.race([
    Promise.all(batch.map((c) => h.intake.receive(owner, "DEV", c))),
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error("deadlock suspected")), 15_000)),
  ]);
  assert.ok(results.every((r) => r.outcome.status === "stored"));
  assert.equal(await countItems(owner.userId), 5, "one album item plus four singles");
  const albumItem = await db.inboxItem.findFirstOrThrow({
    where: { userId: owner.userId, mediaGroupId: "grp-dl" },
    include: { parts: true },
  });
  assert.equal(albumItem.parts.length, 3);
});

test("another user is not blocked while a user lock is held", async () => {
  const a = await makeUser("lock-a");
  const b = await makeUser("lock-b");
  const h = makeIntake();

  let release!: () => void;
  const released = new Promise<void>((resolve) => {
    release = resolve;
  });
  let locked!: () => void;
  const lockTaken = new Promise<void>((resolve) => {
    locked = resolve;
  });
  const holder = db.$transaction(
    async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`${a.userId}:DEV`}))`;
      locked();
      await released;
    },
    { timeout: 20_000 },
  );
  await lockTaken;

  const pendingA = h.intake.receive(a, "DEV", capture());
  let aDone = false;
  void pendingA.then(() => {
    aDone = true;
  });

  const resultB = await Promise.race([
    h.intake.receive(b, "DEV", capture()),
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error("user B was blocked")), 3_000)),
  ]);
  assert.equal(resultB.outcome.status, "stored");

  await new Promise((resolve) => setTimeout(resolve, 300));
  assert.equal(aDone, false, "user A waits for its own lock");

  release();
  await holder;
  assert.equal((await pendingA).outcome.status, "stored");
});

test("a redelivered update does not wait for the user lock", async () => {
  const owner = await makeUser("dup-fast");
  const h = makeIntake();
  const cap = capture();
  assert.equal((await h.intake.receive(owner, "DEV", cap)).outcome.status, "stored");

  let release!: () => void;
  const released = new Promise<void>((resolve) => {
    release = resolve;
  });
  let locked!: () => void;
  const lockTaken = new Promise<void>((resolve) => {
    locked = resolve;
  });
  const holder = db.$transaction(
    async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`${owner.userId}:DEV`}))`;
      locked();
      await released;
    },
    { timeout: 20_000 },
  );
  await lockTaken;

  const duplicate = await Promise.race([
    h.intake.receive(owner, "DEV", cap),
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error("duplicate waited for the lock")), 3_000)),
  ]);
  assert.equal(duplicate.outcome.status, "duplicate");
  release();
  await holder;
});

test("sixth photo is dropped with ALBUM_TRUNCATED set once", async () => {
  const owner = await makeUser("trunc");
  const h = makeIntake();
  for (let i = 0; i < 5; i += 1) {
    assert.equal((await h.intake.receive(owner, "DEV", photo("grp-trunc"))).outcome.status, "stored");
  }
  assert.equal((await h.intake.receive(owner, "DEV", photo("grp-trunc"))).outcome.status, "truncated");
  assert.equal((await h.intake.receive(owner, "DEV", photo("grp-trunc"))).outcome.status, "truncated");
  const item = await db.inboxItem.findFirstOrThrow({ where: { userId: owner.userId }, include: { parts: true } });
  assert.equal(item.parts.length, 5);
  assert.deepEqual(item.ruleCodes, ["ALBUM_TRUNCATED"]);
  assert.equal(await countItems(owner.userId), 1);
});

test("limits and unsupported content are rejected without a record", async () => {
  const owner = await makeUser("reject");
  const h = makeIntake();

  const long = await h.intake.receive(owner, "DEV", capture({ text: "x".repeat(CAPTURE_LIMITS.maxTextChars + 1) }));
  assert.deepEqual(long.outcome, { status: "rejected", reason: "TEXT_TOO_LONG" });

  const big = await h.intake.receive(owner, "DEV", photo("grp-big", { photoTooLarge: true, fileId: null }));
  assert.deepEqual(big.outcome, { status: "rejected", reason: "PHOTO_TOO_LARGE" });

  const unsupported = await h.intake.receive(owner, "DEV", capture({ partKind: "UNSUPPORTED", text: null }));
  assert.deepEqual(unsupported.outcome, { status: "rejected", reason: "UNSUPPORTED" });

  const exactly = await h.intake.receive(owner, "DEV", capture({ text: "x".repeat(CAPTURE_LIMITS.maxTextChars) }));
  assert.equal(exactly.outcome.status, "stored");

  assert.deepEqual(h.replies, [CAPTURE_REPLIES.textTooLong, CAPTURE_REPLIES.photoTooLarge, CAPTURE_REPLIES.unsupported]);
  assert.equal(await countItems(owner.userId), 1);
});

test("deferred step: single message is claimed at once and handed to the processor (default: FAILED quietly)", async () => {
  const owner = await makeUser("process");
  const h = makeIntake();
  const result = await h.intake.receive(owner, "DEV", capture());
  assert.ok(result.afterResponse);
  await result.afterResponse!();

  const id = result.outcome.status === "stored" ? result.outcome.inboxItemId : "";
  const item = await db.inboxItem.findUniqueOrThrow({ where: { id } });
  assert.equal(item.status, "FAILED");
  assert.equal(item.error, "PROCESSOR_NOT_IMPLEMENTED");
  assert.deepEqual(h.processed, [id]);
  assert.deepEqual(h.typing, [4242]);
  assert.deepEqual(h.replies, []);

  await result.afterResponse!();
  assert.deepEqual(h.processed, [id], "a second run loses the CAS and does nothing");
});

test("deferred step: only the handler of the last album part processes, with parts numbered by message id", async () => {
  const owner = await makeUser("album-process");
  const h = makeIntake();
  const p1 = photo("grp-proc", { messageId: 300 });
  const p2 = photo("grp-proc", { messageId: 301 });
  const p3 = photo("grp-proc", { messageId: 302 });
  // Arrive out of order to prove numbering is by telegramMessageId.
  const r2 = await h.intake.receive(owner, "DEV", p2);
  h.clock.t += 100;
  const r3 = await h.intake.receive(owner, "DEV", p3);
  h.clock.t += 100;
  const r1 = await h.intake.receive(owner, "DEV", p1);

  // Earlier handlers wake up first; only the last debounce lets a claim through.
  for (const r of [r2, r3, r1]) await r.afterResponse!();

  assert.equal(h.processed.length, 1);
  const item = await db.inboxItem.findFirstOrThrow({
    where: { userId: owner.userId },
    include: { parts: { orderBy: { position: "asc" } } },
  });
  assert.deepEqual(item.parts.map((part) => part.telegramMessageId), [300, 301, 302]);
  assert.deepEqual(item.parts.map((part) => part.position), [0, 1, 2]);
});

test("a throwing processor marks the item FAILED with PROCESSOR_ERROR", async () => {
  const owner = await makeUser("proc-error");
  const h = makeIntake({
    processor: {
      async process() {
        throw new Error("boom: sensitive message text");
      },
    },
  });
  const logged: string[] = [];
  const original = console.error;
  console.error = (...args: unknown[]) => logged.push(args.map(String).join(" "));
  try {
    const result = await h.intake.receive(owner, "DEV", capture());
    await result.afterResponse!();
    const id = result.outcome.status === "stored" ? result.outcome.inboxItemId : "";
    const item = await db.inboxItem.findUniqueOrThrow({ where: { id } });
    assert.equal(item.status, "FAILED");
    assert.equal(item.error, "PROCESSOR_ERROR");
  } finally {
    console.error = original;
  }
  assert.ok(logged.some((line) => line.includes("code=PROCESSOR_ERROR")));
  assert.ok(logged.every((line) => !line.includes("sensitive")));
});
