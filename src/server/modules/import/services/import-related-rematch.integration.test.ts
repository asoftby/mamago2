/**
 * «Это одно событие» и «изменение просмотрено» на реальной БД (нужна БД;
 * гоняется через scripts/git/gate-env.sh на одноразовом Postgres).
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test, { after, before } from "node:test";
import prisma from "@/lib/prisma";
import { matchRecord } from "./import-matching.service";
import { applyDecision } from "./import-review.service";
import { publishApprovedEventRecord } from "./import-publish.service";
import { ensureImportReviewTaskExists } from "./import-review-task.service";
import { REMATCH_LIMIT, rematchRelatedPendingRecords } from "./import-related-rematch.service";
import { acknowledgeSourceChange } from "./import-source-change.service";
import { skippedFlags } from "../normalizers/telegram-post.mapper";

const tag = randomUUID().slice(0, 8);
let tgSource = "";
let webSource = "";
let adminId = "";
const activityIds: string[] = [];
let seq = 0;

const nd = (title: string) => ({
  entityType: "EVENT", sourceSlug: "x", sourceUrl: "https://example.org/e", title,
  venueName: "Фудмолл Конкорс", addressText: "ул. Бобруйская, 6", cityName: "Минск",
  startAt: "2030-11-07T15:00:00+03:00", typeCandidate: "EVENT", scheduleModeCandidate: "ONE_TIME",
  shortDescCandidate: "Фестиваль для подростков.", categoryCandidates: [], imageUrls: [],
});

async function record(sourceId: string, title: string, over: { telegram?: boolean; reviewStatus?: "PENDING" | "APPROVED"; flags?: object } = {}) {
  const r = await prisma.importedRecord.create({
    data: {
      sourceId, externalId: `rel-${tag}-${++seq}`, entityTypeHint: "EVENT", parseStatus: "SUCCESS", normalizeStatus: "SUCCESS",
      normalizedData: nd(title) as object, qualityScore: 0.8,
      ...(over.flags ? { qualityFlags: over.flags } : over.telegram ? { qualityFlags: { ...skippedFlags("poll", "EVENT"), skipReason: null } as object } : {}),
    },
  });
  await ensureImportReviewTaskExists(r.id);
  if (over.reviewStatus) await prisma.importedRecord.update({ where: { id: r.id }, data: { reviewStatus: over.reviewStatus } });
  return r;
}

const reload = (id: string) => prisma.importedRecord.findUniqueOrThrow({ where: { id }, include: { reviewTask: true } });

async function approveAndPublish(recordId: string) {
  const task = await prisma.importReviewTask.findUniqueOrThrow({ where: { importedRecordId: recordId } });
  await applyDecision(task.id, { decision: "APPROVED_CREATE", targetEntityId: null, targetEntityType: null, selectedCandidateId: null, notes: null, reviewerUserId: adminId, reviewedAt: new Date().toISOString() });
  const result = await publishApprovedEventRecord(recordId, adminId);
  assert.equal(result.success, true, "reason" in result ? result.reason : "");
  if (result.success) activityIds.push(result.placeId);
  return result.success ? result.placeId : "";
}

before(async () => {
  tgSource = (await prisma.importSource.create({ data: { name: `tg ${tag}`, slug: `rel-tg-${tag}`, type: "TELEGRAM_CHANNEL", parserKey: "telegram-channel-event", defaultEntity: "EVENT" } })).id;
  webSource = (await prisma.importSource.create({ data: { name: `web ${tag}`, slug: `rel-web-${tag}`, type: "WEBSITE", parserKey: "abws-performances-event", defaultEntity: "EVENT" } })).id;
  adminId = (await prisma.user.create({ data: { email: `rel-admin-${tag}@example.invalid`, role: "ADMIN" }, select: { id: true } })).id;
});

after(async () => {
  await prisma.importedRecord.updateMany({ where: { sourceId: { in: [tgSource, webSource] } }, data: { publishedActivityId: null } });
  await prisma.importedRecord.deleteMany({ where: { sourceId: { in: [tgSource, webSource] } } });
  await prisma.importSource.deleteMany({ where: { id: { in: [tgSource, webSource] } } });
  if (activityIds.length) await prisma.activity.deleteMany({ where: { id: { in: activityIds } } });
  await prisma.user.delete({ where: { id: adminId } }).catch(() => undefined);
  await prisma.$disconnect();
});

test("publishing the channel post gives the other source's pending record the new event as a candidate", async () => {
  const other = await record(webSource, "Фестиваль Аниме");
  const tg = await record(tgSource, "Фестиваль Аниме", { telegram: true });
  await matchRecord(tg.id); // finds `other` as a possible duplicate and stores the hint
  assert.equal(((await reload(tg.id)).qualityFlags as { pendingDuplicates?: { recordId: string }[] }).pendingDuplicates?.[0]?.recordId, other.id);
  assert.equal((await reload(other.id)).matchCandidates, null, "before: not matched yet, no event in the catalog");

  const activityId = await approveAndPublish(tg.id);

  const after = await reload(other.id);
  const candidates = after.matchCandidates as { entityId: string; score: number }[];
  assert.equal(candidates[0]?.entityId, activityId, "the other record now sees the published event");
  assert.ok((candidates[0]?.score ?? 0) >= 0.7);
  assert.ok(["UPDATE_EXISTING", "MERGE"].includes(after.reviewTask?.suggestedAction ?? ""), `suggested: ${after.reviewTask?.suggestedAction}`);
  assert.equal(after.reviewStatus, "PENDING", "nothing is merged or decided automatically");
  assert.equal(after.publishedActivityId, null);
});

test("it works the other way round: publishing the other source's record updates the channel post", async () => {
  const web = await record(webSource, "Квест в темноте");
  const tg = await record(tgSource, "Квест в темноте", { telegram: true });
  await matchRecord(tg.id);
  assert.equal(((await reload(tg.id)).qualityFlags as { pendingDuplicates?: unknown[] }).pendingDuplicates?.length, 1);

  const activityId = await approveAndPublish(web.id);

  const candidates = (await reload(tg.id)).matchCandidates as { entityId: string }[];
  assert.equal(candidates[0]?.entityId, activityId);
  // The stale "possible duplicate" hint is gone: the other record is no longer pending.
  assert.equal(((await reload(tg.id)).qualityFlags as { pendingDuplicates?: unknown }).pendingDuplicates, undefined);
});

test("rematch touches only records that still wait for a decision, and is capped", async () => {
  const published = await record(tgSource, "Опубликованная", { telegram: true });
  const waiting = await record(webSource, "Ждёт");
  const decided = await record(webSource, "Решена", { reviewStatus: "APPROVED" });
  const hint = (ids: string[]) =>
    ({ ...skippedFlags("poll", "EVENT"), skipReason: null, pendingDuplicates: ids.map((recordId) => ({ recordId, sourceId: "s", title: "t", score: 0.8, reason: "" })) }) as object;
  await prisma.importedRecord.update({ where: { id: published.id }, data: { qualityFlags: hint([waiting.id, decided.id, "missing-id"]) } });

  const seen: string[] = [];
  const result = await rematchRelatedPendingRecords(published.id, { matchRecord: async (id) => { seen.push(id); } });
  assert.deepEqual(result, { rematched: [waiting.id], failed: [] }, "decided, missing and the published record itself are left alone");
  assert.deepEqual(seen, [waiting.id]);

  // One failing match does not stop the others.
  const second = await record(webSource, "Ждёт 2");
  await prisma.importedRecord.update({ where: { id: published.id }, data: { qualityFlags: hint([waiting.id, second.id]) } });
  const mixed = await rematchRelatedPendingRecords(published.id, { matchRecord: async (id) => { if (id === waiting.id) throw new Error("boom"); } });
  assert.deepEqual([mixed.rematched, mixed.failed], [[second.id], [waiting.id]]);

  // Nothing related: no work.
  const isolated = await record(webSource, "Ни с кем не связана");
  assert.deepEqual(await rematchRelatedPendingRecords(isolated.id, { matchRecord: async () => assert.fail("no match call") }), { rematched: [], failed: [] });
  assert.ok(REMATCH_LIMIT >= 5 && REMATCH_LIMIT <= 100);
});

test("a source change is acknowledged: flag cleared, task closed, other flags kept", async () => {
  const r = await record(tgSource, "Изменённый пост", {
    flags: { ...skippedFlags("poll", "EVENT"), skipReason: null, audienceHint: "подростки", sourceChanged: { fields: ["dates"], detectedAt: "2030-10-30T10:00:00Z" } } as object,
  });
  assert.equal((await reload(r.id)).reviewTask?.status, "PENDING");

  assert.deepEqual(await acknowledgeSourceChange(r.id, adminId), { ok: true });
  const after = await reload(r.id);
  const flags = after.qualityFlags as { sourceChanged?: unknown; audienceHint?: string; source: string };
  assert.equal(flags.sourceChanged, undefined);
  assert.equal(flags.audienceHint, "подростки", "the rest of the flags is kept");
  assert.equal(flags.source, "telegram");
  assert.equal(after.reviewTask?.status, "COMPLETED");
  assert.equal(after.reviewTask?.reviewerUserId, adminId);
  assert.ok(after.reviewTask?.reviewedAt);

  // Nothing left to acknowledge, and unknown records are reported.
  assert.deepEqual(await acknowledgeSourceChange(r.id, adminId), { ok: false, reason: "no_change" });
  assert.deepEqual(await acknowledgeSourceChange("missing-id", adminId), { ok: false, reason: "not_found" });
  const plain = await record(webSource, "Не из Telegram");
  assert.deepEqual(await acknowledgeSourceChange(plain.id, adminId), { ok: false, reason: "no_change" });
});
