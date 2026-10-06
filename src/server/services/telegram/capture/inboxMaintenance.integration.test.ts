/**
 * Integration tests for inbox purge/recover against a scratch Postgres
 * (DATABASE_URL, migrations applied). Creates and removes its own rows.
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test, { after, before } from "node:test";
import { PrismaClient, type InboxStatus } from "@prisma/client";
import type { InboxProcessor } from "./inboxProcessor";
import { purgeInbox } from "./inboxPurge";
import {
  recoverInbox,
  RECOVER_ATTEMPT_CODE,
  RECOVER_STALE_AFTER_PROCESSING_MS,
  RECOVER_STALE_AFTER_RECEIVED_MS,
} from "./inboxRecover";

const db = new PrismaClient();
const run = randomUUID().slice(0, 8);
const DAY = 24 * 60 * 60 * 1000;
const userIds: string[] = [];
let counter = 0;

async function makeUser(label: string): Promise<string> {
  const id = `maint-${run}-${label}`;
  await db.user.create({ data: { id, email: `${id}@example.test` } });
  userIds.push(id);
  return id;
}

type ItemSpec = {
  userId: string;
  status: InboxStatus;
  purgeAfter: Date;
  createdAt?: Date;
  debounceUntil?: Date;
  text?: string | null;
  fileId?: string | null;
  draft?: object | null;
  ruleCodes?: string[];
  parts?: number;
};

async function makeItem(spec: ItemSpec) {
  counter += 1;
  const parts = spec.parts ?? 1;
  return db.inboxItem.create({
    data: {
      userId: spec.userId,
      environment: "DEV",
      telegramChatId: BigInt(1),
      sourceKind: "TEXT",
      anchorAt: new Date(),
      anchorIsForward: false,
      debounceUntil: spec.debounceUntil ?? new Date(),
      status: spec.status,
      purgeAfter: spec.purgeAfter,
      ...(spec.createdAt ? { createdAt: spec.createdAt } : {}),
      ...(spec.draft === null ? {} : { draft: spec.draft ?? { marker: `MAINT_DRAFT_${run}_${counter}` } }),
      ruleCodes: spec.ruleCodes ?? [],
      parts: {
        create: Array.from({ length: parts }, (_, index) => ({
          environment: "DEV" as const,
          telegramUpdateId: BigInt(Date.now()) * BigInt(1000) + BigInt(counter * 10 + index),
          telegramMessageId: counter * 10 + index,
          kind: "TEXT" as const,
          text: spec.text === null ? null : (spec.text ?? `MAINT_TEXT_${run}_${counter}_${index}`),
          telegramFileId: spec.fileId === undefined ? null : spec.fileId,
          position: index,
        })),
      },
    },
    include: { parts: true },
  });
}

const reload = (id: string) => db.inboxItem.findUnique({ where: { id }, include: { parts: true } });

before(async () => {
  await db.$connect();
});

after(async () => {
  await db.inboxItem.deleteMany({ where: { userId: { in: userIds } } });
  await db.user.deleteMany({ where: { id: { in: userIds } } });
  await db.$disconnect();
});

// ------------------------------------------------------------------ purge

test("purge: expired items in every status lose text and draft; fresh ones are untouched; statuses stay", async () => {
  const userId = await makeUser("purge-status");
  const past = new Date(Date.now() - 60_000);
  const future = new Date(Date.now() + 3_600_000);
  const expired = await Promise.all(
    (["RECEIVED", "PROCESSING", "DRAFT_READY", "FAILED", "CONFIRMED", "DISCARDED"] as const).map((status) =>
      makeItem({ userId, status, purgeAfter: past, parts: 2 }),
    ),
  );
  const fresh = await makeItem({ userId, status: "DRAFT_READY", purgeAfter: future });

  const result = await purgeInbox({ db });
  assert.ok(result.itemsScrubbed >= expired.length);

  for (const item of expired) {
    const saved = (await reload(item.id))!;
    assert.equal(saved.status, item.status, "purge never changes a status");
    assert.equal(saved.draft, null);
    assert.ok(saved.parts.every((part) => part.text === null));
    assert.equal(saved.parts.length, 2, "parts are kept, only text is cleared");
  }
  const kept = (await reload(fresh.id))!;
  assert.ok(kept.draft);
  assert.ok(kept.parts.every((part) => part.text !== null));
});

test("purge: items older than 30 days are deleted with their parts; younger expired ones are only scrubbed", async () => {
  const userId = await makeUser("purge-old");
  const past = new Date(Date.now() - 60_000);
  const old = await makeItem({ userId, status: "CONFIRMED", purgeAfter: past, createdAt: new Date(Date.now() - 31 * DAY), parts: 3 });
  const recent = await makeItem({ userId, status: "FAILED", purgeAfter: past, createdAt: new Date(Date.now() - 29 * DAY) });

  const result = await purgeInbox({ db });
  assert.ok(result.itemsDeleted >= 1);
  assert.equal(await reload(old.id), null);
  assert.equal(await db.inboxItemPart.count({ where: { inboxItemId: old.id } }), 0);
  const survivor = (await reload(recent.id))!;
  assert.equal(survivor.draft, null);
  assert.equal(survivor.parts[0]!.text, null);
});

test("purge is idempotent: a second run changes nothing and reports zeros", async () => {
  const userId = await makeUser("purge-idem");
  const item = await makeItem({ userId, status: "DRAFT_READY", purgeAfter: new Date(Date.now() - 1000) });
  await purgeInbox({ db });
  const second = await purgeInbox({ db });
  assert.deepEqual(
    { s: second.itemsScrubbed, p: second.partsScrubbed, d: second.draftsCleared, x: second.itemsDeleted },
    { s: 0, p: 0, d: 0, x: 0 },
  );
  const saved = (await reload(item.id))!;
  assert.equal(saved.draft, null);
  assert.equal(saved.status, "DRAFT_READY");
});

test("purge works in small batches and reports truncation when the batch cap is hit", async () => {
  const userId = await makeUser("purge-batch");
  const past = new Date(Date.now() - 60_000);
  const items = await Promise.all(Array.from({ length: 5 }, () => makeItem({ userId, status: "FAILED", purgeAfter: past })));

  const capped = await purgeInbox({ db, batchSize: 2, maxBatches: 1 });
  assert.equal(capped.truncated, true);
  assert.equal(capped.batches, 1);

  const finished = await purgeInbox({ db, batchSize: 2, maxBatches: 50 });
  assert.equal(finished.truncated, false);
  for (const item of items) {
    const saved = (await reload(item.id))!;
    assert.equal(saved.draft, null);
    assert.equal(saved.parts[0]!.text, null);
  }
});

test("purge handles a part with text on an item whose draft is already null (and the reverse)", async () => {
  const userId = await makeUser("purge-partial");
  const past = new Date(Date.now() - 60_000);
  const textOnly = await makeItem({ userId, status: "FAILED", purgeAfter: past, draft: null });
  const draftOnly = await makeItem({ userId, status: "FAILED", purgeAfter: past, text: null });
  await purgeInbox({ db });
  assert.equal((await reload(textOnly.id))!.parts[0]!.text, null);
  assert.equal((await reload(draftOnly.id))!.draft, null);
});

test("purge also clears telegramFileId of expired parts, but not of unexpired ones", async () => {
  const userId = await makeUser("purge-fileid");
  const past = new Date(Date.now() - 60_000);
  const future = new Date(Date.now() + 3_600_000);
  const expired = await Promise.all(
    (["RECEIVED", "PROCESSING", "DRAFT_READY", "FAILED", "CONFIRMED"] as const).map((status) =>
      makeItem({ userId, status, purgeAfter: past, fileId: `MAINT_FILE_${run}_${status}` }),
    ),
  );
  const fresh = await makeItem({ userId, status: "DRAFT_READY", purgeAfter: future, fileId: `MAINT_FILE_${run}_FRESH` });

  await purgeInbox({ db });
  for (const item of expired) {
    const saved = (await reload(item.id))!;
    assert.ok(saved.parts.every((part) => part.telegramFileId === null), `file id kept for ${item.status}`);
    assert.equal(saved.status, item.status);
  }
  assert.equal((await reload(fresh.id))!.parts[0]!.telegramFileId, `MAINT_FILE_${run}_FRESH`);

  const second = await purgeInbox({ db });
  assert.equal(second.itemsScrubbed, 0, "second run is a no-op");
});

test("purge scrubs an expired item whose only remaining content is a file reference", async () => {
  const userId = await makeUser("purge-fileonly");
  const item = await makeItem({
    userId,
    status: "FAILED",
    purgeAfter: new Date(Date.now() - 1000),
    text: null,
    draft: null,
    fileId: `MAINT_FILE_${run}_ONLY`,
  });
  const result = await purgeInbox({ db });
  assert.ok(result.partsScrubbed >= 1);
  assert.equal((await reload(item.id))!.parts[0]!.telegramFileId, null);
});

test("purge returns counts only: no content in the result", async () => {
  const userId = await makeUser("purge-nocontent");
  await makeItem({ userId, status: "FAILED", purgeAfter: new Date(Date.now() - 1000), text: "MAINT_SECRET_TEXT" });
  const result = await purgeInbox({ db });
  assert.ok(!JSON.stringify(result).includes("MAINT_SECRET_TEXT"));
  assert.ok(Object.values(result).every((value) => typeof value === "number" || typeof value === "boolean"));
});

// ------------------------------------------------------------------ recover

const MIN = 60_000;

function fakeProcessor(over: { onProcess?: (id: string) => Promise<void> } = {}) {
  const calls: string[] = [];
  const processor: InboxProcessor = {
    async process(id) {
      calls.push(id);
      if (over.onProcess) return over.onProcess(id);
      await db.inboxItem.updateMany({ where: { id, status: "PROCESSING" }, data: { status: "DRAFT_READY", draft: { ok: true } } });
    },
  };
  return { processor, calls };
}

const stale = () => new Date(Date.now() - 3 * MIN);
const staleProcessing = () => new Date(Date.now() - 6 * MIN);
const farFuture = new Date(Date.now() + 7 * DAY);

test("recover: only old RECEIVED/PROCESSING items are picked up; fresh and terminal ones are untouched", async () => {
  const userId = await makeUser("rec-select");
  const oldReceived = await makeItem({ userId, status: "RECEIVED", purgeAfter: farFuture, debounceUntil: stale() });
  const oldProcessing = await makeItem({ userId, status: "PROCESSING", purgeAfter: farFuture, debounceUntil: staleProcessing() });
  const freshReceived = await makeItem({ userId, status: "RECEIVED", purgeAfter: farFuture, debounceUntil: new Date(Date.now() - 30_000) });
  const freshProcessing = await makeItem({ userId, status: "PROCESSING", purgeAfter: farFuture, debounceUntil: new Date() });
  const midProcessing = await makeItem({ userId, status: "PROCESSING", purgeAfter: farFuture, debounceUntil: stale() });
  const terminal = await Promise.all(
    (["DRAFT_READY", "FAILED", "CONFIRMED", "DISCARDED"] as const).map((status) =>
      makeItem({ userId, status, purgeAfter: farFuture, debounceUntil: stale() }),
    ),
  );

  const { processor, calls } = fakeProcessor();
  const result = await recoverInbox({ db, processor, maxItemsPerRun: 50 });
  assert.ok(result.recovered >= 2);

  assert.ok(calls.includes(oldReceived.id));
  assert.ok(calls.includes(oldProcessing.id));
  assert.ok(!calls.includes(freshReceived.id));
  assert.ok(!calls.includes(freshProcessing.id));
  assert.ok(!calls.includes(midProcessing.id), "a PROCESSING item idle for only 3 minutes may still be running");
  for (const item of terminal) assert.ok(!calls.includes(item.id));

  assert.equal((await reload(oldReceived.id))!.status, "DRAFT_READY");
  assert.equal((await reload(freshReceived.id))!.status, "RECEIVED");
  assert.equal((await reload(freshProcessing.id))!.status, "PROCESSING");
  assert.equal((await reload(midProcessing.id))!.status, "PROCESSING");
  for (const item of terminal) assert.equal((await reload(item.id))!.status, item.status);
});

test("recover: an old RECEIVED item is claimed to PROCESSING and its parts are numbered by message id", async () => {
  const userId = await makeUser("rec-claim");
  const item = await makeItem({ userId, status: "RECEIVED", purgeAfter: farFuture, debounceUntil: stale(), parts: 3 });
  let seen: string | null = null;
  const { processor } = fakeProcessor({
    onProcess: async (id) => {
      const current = (await reload(id))!;
      seen = `${current.status}:${current.parts.sort((a, b) => a.position - b.position).map((p) => p.telegramMessageId).join(",")}`;
      await db.inboxItem.updateMany({ where: { id, status: "PROCESSING" }, data: { status: "DRAFT_READY" } });
    },
  });
  await recoverInbox({ db, processor, maxItemsPerRun: 50 });
  const ids = item.parts.map((p) => p.telegramMessageId).sort((a, b) => a - b).join(",");
  assert.equal(seen, `PROCESSING:${ids}`);
  assert.ok((await reload(item.id))!.ruleCodes.includes(RECOVER_ATTEMPT_CODE));
});

test("recover: concurrent runs never process the same item twice", async () => {
  const userId = await makeUser("rec-race");
  const items = await Promise.all(Array.from({ length: 3 }, () => makeItem({ userId, status: "RECEIVED", purgeAfter: farFuture, debounceUntil: stale() })));
  const { processor, calls } = fakeProcessor();
  await Promise.all(Array.from({ length: 4 }, () => recoverInbox({ db, processor, maxItemsPerRun: 50 })));
  for (const item of items) assert.equal(calls.filter((id) => id === item.id).length, 1, "exactly one processing per item");
});

test("recover: a stuck item is retried up to the cap, then FAILED with RECOVER_EXHAUSTED", async () => {
  const userId = await makeUser("rec-cap");
  const item = await makeItem({ userId, status: "PROCESSING", purgeAfter: farFuture, debounceUntil: staleProcessing() });
  const stuck = fakeProcessor({ onProcess: async () => undefined });
  const age = async () => db.inboxItem.update({ where: { id: item.id }, data: { debounceUntil: staleProcessing() } });

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    await age();
    await recoverInbox({ db, processor: stuck.processor, maxItemsPerRun: 50, maxAttempts: 3 });
    assert.equal(stuck.calls.filter((id) => id === item.id).length, attempt);
    assert.equal((await reload(item.id))!.status, "PROCESSING");
  }
  await age();
  const last = await recoverInbox({ db, processor: stuck.processor, maxItemsPerRun: 50, maxAttempts: 3 });
  assert.equal(stuck.calls.filter((id) => id === item.id).length, 3, "no fourth attempt");
  assert.ok(last.failed >= 1);
  const saved = (await reload(item.id))!;
  assert.equal(saved.status, "FAILED");
  assert.equal(saved.error, "RECOVER_EXHAUSTED");
  assert.ok(saved.processedAt);
});

test("recover: a throwing processor ends as FAILED PROCESSOR_ERROR; a terminal state set by the processor is kept", async () => {
  const userId = await makeUser("rec-error");
  const broken = await makeItem({ userId, status: "RECEIVED", purgeAfter: farFuture, debounceUntil: stale() });
  const discard = await makeItem({ userId, status: "RECEIVED", purgeAfter: farFuture, debounceUntil: stale() });
  const lines: string[] = [];
  const original = console.error;
  console.error = (...args: unknown[]) => void lines.push(args.map(String).join(" "));
  try {
    const { processor } = fakeProcessor({
      onProcess: async (id) => {
        if (id === broken.id) throw new Error("boom SENSITIVE_TEXT");
        await db.inboxItem.update({ where: { id }, data: { status: "DISCARDED" } });
      },
    });
    await recoverInbox({ db, processor, maxItemsPerRun: 50 });
  } finally {
    console.error = original;
  }
  const failed = (await reload(broken.id))!;
  assert.equal(failed.status, "FAILED");
  assert.equal(failed.error, "PROCESSOR_ERROR");
  assert.equal((await reload(discard.id))!.status, "DISCARDED");
  assert.ok(lines.every((line) => !line.includes("SENSITIVE_TEXT") && !line.includes("MAINT_")));
});

test("recover: respects the per-run item limit and the run deadline", async () => {
  const userId = await makeUser("rec-limit");
  const items = await Promise.all(Array.from({ length: 4 }, () => makeItem({ userId, status: "RECEIVED", purgeAfter: farFuture, debounceUntil: stale() })));
  const { processor, calls } = fakeProcessor();
  // Other tests leave no stale rows behind; limit applies to this run.
  const limited = await recoverInbox({ db, processor, maxItemsPerRun: 2 });
  assert.equal(limited.candidates, 2);
  assert.equal(calls.length, 2);

  let tick = 0;
  const base = Date.now();
  const clock = () => new Date(base + tick++ * 100_000);
  const rest = fakeProcessor();
  const deadline = await recoverInbox({ db, processor: rest.processor, maxItemsPerRun: 50, deadlineMs: 150_000, now: clock });
  assert.equal(deadline.deadlineHit, true);
  assert.ok(rest.calls.length <= 2);
  void items;
});

test("recover thresholds are 2 minutes for RECEIVED and 5 minutes for PROCESSING", () => {
  assert.equal(RECOVER_STALE_AFTER_RECEIVED_MS, 2 * MIN);
  assert.equal(RECOVER_STALE_AFTER_PROCESSING_MS, 5 * MIN);
});

test("recover boundaries are inclusive: exactly at the threshold is recovered, one millisecond younger is not", async () => {
  const userId = await makeUser("rec-bound");
  const now = new Date();
  const clock = () => now;
  const at = (ms: number) => new Date(now.getTime() - ms);

  const receivedAt = await makeItem({ userId, status: "RECEIVED", purgeAfter: farFuture, debounceUntil: at(2 * MIN) });
  const receivedYounger = await makeItem({ userId, status: "RECEIVED", purgeAfter: farFuture, debounceUntil: at(2 * MIN - 1) });
  const processingAt = await makeItem({ userId, status: "PROCESSING", purgeAfter: farFuture, debounceUntil: at(5 * MIN) });
  const processingYounger = await makeItem({ userId, status: "PROCESSING", purgeAfter: farFuture, debounceUntil: at(5 * MIN - 1) });
  const processingAtReceivedLimit = await makeItem({ userId, status: "PROCESSING", purgeAfter: farFuture, debounceUntil: at(2 * MIN) });

  const { processor, calls } = fakeProcessor();
  await recoverInbox({ db, processor, now: clock, maxItemsPerRun: 100 });

  assert.ok(calls.includes(receivedAt.id), "RECEIVED at exactly 2 minutes");
  assert.ok(!calls.includes(receivedYounger.id), "RECEIVED 1 ms younger than 2 minutes");
  assert.ok(calls.includes(processingAt.id), "PROCESSING at exactly 5 minutes");
  assert.ok(!calls.includes(processingYounger.id), "PROCESSING 1 ms younger than 5 minutes");
  assert.ok(!calls.includes(processingAtReceivedLimit.id), "PROCESSING is not governed by the RECEIVED threshold");
});

test("recover thresholds can be overridden per status", async () => {
  const userId = await makeUser("rec-override");
  const received = await makeItem({ userId, status: "RECEIVED", purgeAfter: farFuture, debounceUntil: new Date(Date.now() - 20_000) });
  const processing = await makeItem({ userId, status: "PROCESSING", purgeAfter: farFuture, debounceUntil: new Date(Date.now() - 20_000) });
  const { processor, calls } = fakeProcessor();
  await recoverInbox({ db, processor, staleAfterReceivedMs: 10_000, staleAfterProcessingMs: 60_000, maxItemsPerRun: 100 });
  assert.ok(calls.includes(received.id));
  assert.ok(!calls.includes(processing.id));
});
