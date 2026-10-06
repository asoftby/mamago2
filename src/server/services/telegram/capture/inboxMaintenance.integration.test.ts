/**
 * Integration tests for inbox purge/recover against a scratch Postgres
 * (DATABASE_URL, migrations applied). Creates and removes its own rows.
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test, { after, before } from "node:test";
import { PrismaClient, type InboxStatus } from "@prisma/client";
import { purgeInbox } from "./inboxPurge";

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

test("purge returns counts only: no content in the result", async () => {
  const userId = await makeUser("purge-nocontent");
  await makeItem({ userId, status: "FAILED", purgeAfter: new Date(Date.now() - 1000), text: "MAINT_SECRET_TEXT" });
  const result = await purgeInbox({ db });
  assert.ok(!JSON.stringify(result).includes("MAINT_SECRET_TEXT"));
  assert.ok(Object.values(result).every((value) => typeof value === "number" || typeof value === "boolean"));
});
