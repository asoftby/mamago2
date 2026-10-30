/**
 * Суточная сводка по каналам на реальной БД (нужна БД; гоняется через
 * scripts/git/gate-env.sh на одноразовом Postgres).
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test, { after, before } from "node:test";
import prisma from "@/lib/prisma";
import { collectChannelsDigest, runChannelsDigest, type DigestDeps } from "./import-channels-digest.service";
import { ensureImportReviewTaskExists } from "./import-review-task.service";
import { skippedFlags } from "../normalizers/telegram-post.mapper";

const tag = randomUUID().slice(0, 8);
const NOW = new Date("2030-10-30T07:00:00Z"); // 10:00 Минск
const RECENT = new Date("2030-10-30T03:00:00Z");
const OLD = new Date("2030-10-25T03:00:00Z");
let sourceId = "";
let otherSourceId = "";
let adminIds: string[] = [];
let activityId = "";
let ownerId = "";

const flags = (over: object = {}) => ({ ...skippedFlags("poll", "EVENT"), skipReason: null, ...over });

async function record(
  externalId: string,
  over: { createdAt?: Date; sourceId?: string; flags?: object; matchStatus?: "AMBIGUOUS" | "NO_MATCH"; normalizeStatus?: "SUCCESS" | "SKIPPED"; published?: boolean; task?: boolean } = {},
) {
  const r = await prisma.importedRecord.create({
    data: {
      sourceId: over.sourceId ?? sourceId, externalId, entityTypeHint: "EVENT", parseStatus: "SUCCESS",
      normalizeStatus: over.normalizeStatus ?? "SUCCESS", matchStatus: over.matchStatus ?? "NO_MATCH",
      createdAt: over.createdAt ?? RECENT, normalizedData: { title: externalId } as object,
      qualityFlags: (over.flags ?? flags()) as object,
      ...(over.published ? { publishedActivityId: activityId } : {}),
    },
  });
  if (over.task !== false) await ensureImportReviewTaskExists(r.id);
  return r;
}

before(async () => {
  sourceId = (await prisma.importSource.create({ data: { name: `Канал ${tag}`, slug: `dg-${tag}`, type: "TELEGRAM_CHANNEL", parserKey: "telegram-channel-event", defaultEntity: "EVENT" } })).id;
  otherSourceId = (await prisma.importSource.create({ data: { name: `Сайт ${tag}`, slug: `dg-web-${tag}`, type: "WEBSITE", defaultEntity: "EVENT" } })).id;
  adminIds = await Promise.all([1, 2].map(async (i) => (await prisma.user.create({ data: { email: `dg-admin-${i}-${tag}@example.invalid`, role: "ADMIN" }, select: { id: true } })).id));
  ownerId = (await prisma.user.create({ data: { email: `dg-owner-${tag}@example.invalid` }, select: { id: true } })).id;
  activityId = (await prisma.activity.create({
    data: { ownerUserId: ownerId, title: `Published ${tag}`, shortDesc: "fixture", type: "EVENT", status: "PUBLISHED", scheduleMode: "ONE_TIME", schedulingKind: "SLOT", scheduleJson: { durationMinutes: 60 } },
    select: { id: true },
  })).id;
});

after(async () => {
  await prisma.importRun.deleteMany({ where: { sourceId: { in: [sourceId, otherSourceId] } } });
  await prisma.importedRecord.updateMany({ where: { sourceId: { in: [sourceId, otherSourceId] } }, data: { publishedActivityId: null } });
  await prisma.importedRecord.deleteMany({ where: { sourceId: { in: [sourceId, otherSourceId] } } });
  await prisma.importSource.deleteMany({ where: { id: { in: [sourceId, otherSourceId] } } });
  await prisma.activity.delete({ where: { id: activityId } }).catch(() => undefined);
  await prisma.user.deleteMany({ where: { id: { in: [...adminIds, ownerId] } } });
  await prisma.$disconnect();
});

test("no Telegram records and no usage: nothing to say", async () => {
  const stats = await collectChannelsDigest(NOW);
  assert.equal(stats.sources, 1);
  assert.deepEqual([stats.newRecords, stats.possibleDuplicates, stats.changedPublished, stats.waiting, stats.aiCalls], [0, 0, 0, 0, 0]);
  assert.deepEqual(await runChannelsDigest(NOW, fakeDeps().deps), { sent: 0, skipped: "nothing_to_say" });
});

test("counts new posts, possible duplicates, published changes, backlog and model usage for the last day", async () => {
  await record("new-1");
  await record("new-2", { flags: flags({ pendingDuplicates: [{ recordId: "r", sourceId: "s", title: "t", score: 0.8, reason: "" }] }) });
  await record("new-3", { matchStatus: "AMBIGUOUS" });
  await record("skipped", { normalizeStatus: "SKIPPED", task: false }); // not an event for the editor
  await record("old", { createdAt: OLD }); // older than a day, but still waiting for a decision
  await record("changed", { createdAt: OLD, published: true, flags: flags({ sourceChanged: { fields: ["dates"], detectedAt: "2030-10-30T02:00:00Z" } }) });
  await record("changed-long-ago", { createdAt: OLD, published: true, flags: flags({ sourceChanged: { fields: ["dates"], detectedAt: "2030-10-20T02:00:00Z" } }) });
  await record("web-new", { sourceId: otherSourceId, flags: undefined }); // other source types are not included
  await prisma.importedRecord.updateMany({ where: { sourceId }, data: { updatedAt: RECENT } });

  await prisma.importRun.create({ data: { source: { connect: { id: sourceId } }, status: "COMPLETED", startedAt: RECENT, aiCalls: 40, aiTokensIn: 30_000, aiTokensOut: 10_000 } });
  await prisma.importRun.create({ data: { source: { connect: { id: sourceId } }, status: "COMPLETED", startedAt: RECENT, aiCalls: 8, aiTokensIn: 9_000, aiTokensOut: 3_000 } });
  await prisma.importRun.create({ data: { source: { connect: { id: sourceId } }, status: "COMPLETED", startedAt: OLD, aiCalls: 99, aiTokensIn: 1, aiTokensOut: 1 } });

  const stats = await collectChannelsDigest(NOW);
  assert.equal(stats.newRecords, 3);
  assert.equal(stats.possibleDuplicates, 2, "pending duplicate hint + AMBIGUOUS match");
  assert.equal(stats.changedPublished, 1, "only the change detected within the day");
  assert.equal(stats.waiting, 6, "every normalized record with an open task, not just today's");
  assert.equal(stats.aiCalls, 48);
  assert.equal(stats.tokensIn, 39_000);
  assert.equal(stats.tokensOut, 13_000);
  assert.equal(stats.bySource.length, 1);
  assert.equal(stats.bySource[0].aiCalls, 48);
  assert.equal(stats.bySource[0].tokens, 52_000);
});

function fakeDeps(opts: { admins?: string[] } = {}) {
  const sent: { userId: string; title: string; body: string; entityId: string; type: string; audience: string; actionUrl: string }[] = [];
  const deps: DigestDeps = {
    listAdminIds: async () => opts.admins ?? adminIds,
    alreadySent: async (userId, entityId) => sent.some((s) => s.userId === userId && s.entityId === entityId),
    createNotification: async (p) => { sent.push(p); },
  };
  return { deps, sent };
}

test("sends one digest per admin per day, and only after 09:00 Minsk", async () => {
  const { deps, sent } = fakeDeps();

  assert.deepEqual(await runChannelsDigest(new Date("2030-10-30T05:00:00Z"), deps), { sent: 0, skipped: "not_due" });
  assert.equal(sent.length, 0);

  assert.deepEqual(await runChannelsDigest(NOW, deps), { sent: 2, skipped: null });
  assert.deepEqual(sent.map((s) => s.userId).sort(), [...adminIds].sort());
  const first = sent[0];
  assert.equal(first.type, "IMPORT_CHANNELS_DIGEST");
  assert.equal(first.audience, "ADMIN");
  assert.equal(first.entityId, "import-channels-digest:2030-10-30");
  assert.equal(first.actionUrl, "/admin/import/review");
  assert.match(first.body, /3 новых поста, 2 возможных дубля, 1 изменение в опубликованных\. Ждёт решения: 6\./);
  assert.match(first.body, /Модель: 48 вызовов, 52 тыс\. токенов\./);
  assert.ok(!/mamago|t\.me|minsk_kids/i.test(first.title + first.body), "no source address in the text");

  // The cron runs every few minutes: the same day sends nothing more.
  assert.deepEqual(await runChannelsDigest(new Date("2030-10-30T07:05:00Z"), deps), { sent: 0, skipped: null });
  assert.equal(sent.length, 2);
  // The next day sends again.
  assert.deepEqual(await runChannelsDigest(new Date("2030-10-31T07:00:00Z"), deps), { sent: 2, skipped: null });
});

test("no admins: skipped, and a real notification row is written with the real service", async () => {
  assert.deepEqual(await runChannelsDigest(NOW, fakeDeps({ admins: [] }).deps), { sent: 0, skipped: "no_admins" });

  const created = await prisma.notification.create({
    data: { userId: adminIds[0], audience: "ADMIN", type: "IMPORT_CHANNELS_DIGEST", title: "t", body: "b", entityType: "SYSTEM", entityId: "import-channels-digest:probe" },
    select: { type: true, audience: true },
  });
  assert.equal(created.type, "IMPORT_CHANNELS_DIGEST", "the enum value exists in the migrated database");
  await prisma.notification.deleteMany({ where: { userId: { in: adminIds } } });
});
