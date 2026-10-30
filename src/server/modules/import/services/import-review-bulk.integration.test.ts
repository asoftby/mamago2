/**
 * Пакетные действия очереди ревью на реальной БД (нужна БД; гоняется через
 * scripts/git/gate-env.sh на одноразовом Postgres).
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test, { after, before } from "node:test";
import prisma from "@/lib/prisma";
import { applyDecision } from "./import-review.service";
import { ensureImportReviewTaskExists } from "./import-review-task.service";
import { bulkPublishCreateNew, bulkRejectRecords, BULK_REVIEW_MAX, type BulkDeps } from "./import-review-bulk.service";
import { skippedFlags } from "../normalizers/telegram-post.mapper";

const tag = randomUUID().slice(0, 8);
let sourceId = "";
let adminId = "";
const activityIds: string[] = [];

const nd = (title: string, over: Record<string, unknown> = {}) => ({
  entityType: "EVENT", sourceSlug: "x", sourceUrl: "https://example.org/e", title,
  venueName: "Арт-студия Сирень", addressText: "ул. М. Богдановича, 132", cityName: "Минск",
  startAt: "2030-11-08T14:00:00+03:00", typeCandidate: "EVENT", scheduleModeCandidate: "ONE_TIME",
  shortDescCandidate: "Мастер-класс для детей и родителей.", categoryCandidates: [], imageUrls: [], ...over,
});

let seq = 0;
async function record(
  title: string,
  opts: { action?: string | null; flags?: object; data?: object | null; taskStatus?: "PENDING" | "COMPLETED"; reviewStatus?: "PENDING" | "APPROVED"; matchStatus?: "NO_MATCH" | "SKIPPED" | "PENDING" } = {},
) {
  const r = await prisma.importedRecord.create({
    data: {
      sourceId, externalId: `bulk-${tag}-${++seq}`, entityTypeHint: "EVENT", parseStatus: "SUCCESS", normalizeStatus: "SUCCESS", matchStatus: opts.matchStatus ?? "NO_MATCH",
      normalizedData: (opts.data === undefined ? nd(title) : opts.data) as object,
      ...(opts.flags ? { qualityFlags: opts.flags } : {}),
      reviewStatus: opts.reviewStatus ?? "PENDING",
    },
  });
  await ensureImportReviewTaskExists(r.id);
  await prisma.importReviewTask.update({
    where: { importedRecordId: r.id },
    data: { suggestedAction: (opts.action === undefined ? "CREATE_NEW" : opts.action) as never, status: opts.taskStatus ?? "PENDING" },
  });
  // Создание задачи ревью выставляет reviewStatus = PENDING, поэтому нужное значение ставим после.
  if (opts.reviewStatus) await prisma.importedRecord.update({ where: { id: r.id }, data: { reviewStatus: opts.reviewStatus } });
  return r;
}

const reload = (id: string) => prisma.importedRecord.findUniqueOrThrow({ where: { id }, include: { reviewTask: true } });

before(async () => {
  sourceId = (await prisma.importSource.create({ data: { name: `bulk ${tag}`, slug: `bulk-${tag}`, type: "TELEGRAM_CHANNEL", parserKey: "telegram-channel-event", defaultEntity: "EVENT" } })).id;
  adminId = (await prisma.user.create({ data: { email: `bulk-admin-${tag}@example.invalid`, role: "ADMIN" }, select: { id: true } })).id;
});

after(async () => {
  await prisma.importedRecord.updateMany({ where: { sourceId }, data: { publishedActivityId: null } });
  await prisma.importedRecord.deleteMany({ where: { sourceId } });
  await prisma.importSource.delete({ where: { id: sourceId } });
  if (activityIds.length) await prisma.activity.deleteMany({ where: { id: { in: activityIds } } });
  await prisma.user.delete({ where: { id: adminId } }).catch(() => undefined);
  await prisma.$disconnect();
});

const publishOk = (calls: string[]): BulkDeps => ({
  applyDecision,
  publish: (async (id: string) => { calls.push(id); return { success: true, placeId: `act-${id}`, appliedFields: [], skippedFields: [], emptyFields: [] }; }) as never,
  validateMapping: async () => null,
  now: () => new Date(),
});

test("bulk publish takes only safe CREATE_NEW records and says why it skipped the rest", async () => {
  const ok = await record("Подходит");
  const update = await record("Нужен взгляд", { action: "UPDATE_EXISTING" });
  const conflict = await record("Конфликт", { flags: { ...skippedFlags("poll", "EVENT"), skipReason: null, hasConflict: true } });
  const dup = await record("Дубль", { flags: { ...skippedFlags("poll", "EVENT"), skipReason: null, pendingDuplicates: [{ recordId: "r", sourceId: "s", title: "t", score: 0.8, reason: "" }] } });
  const noDate = await record("Без даты", { data: nd("Без даты", { startAt: undefined }) });
  const closed = await record("Уже закрыта", { taskStatus: "COMPLETED" });
  // Matching failed: the fallback recommendation is CREATE_NEW, but duplicates were never checked.
  const matchFailed = await record("Матчинг упал", { matchStatus: "SKIPPED" });
  const published: string[] = [];

  const results = await bulkPublishCreateNew([ok.id, update.id, conflict.id, dup.id, noDate.id, closed.id, matchFailed.id, "missing-id"], adminId, publishOk(published));
  const by = Object.fromEntries(results.map((r) => [r.importedRecordId, r]));

  assert.equal(by[ok.id].outcome, "published");
  assert.equal(by[ok.id].activityId, `act-${ok.id}`);
  assert.deepEqual(published, [ok.id], "only the safe record reaches publish");
  assert.equal(by[update.id].reason, "not_create_new");
  assert.equal(by[conflict.id].reason, "has_conflict");
  assert.equal(by[dup.id].reason, "has_duplicates");
  assert.equal(by[noDate.id].reason, "incomplete");
  assert.equal(by[closed.id].reason, "no_open_task");
  assert.equal(by[matchFailed.id].reason, "not_matched");
  assert.equal(by["missing-id"].reason, "not_found");

  // The decision is saved for the published one only; skipped records are untouched.
  const approved = await reload(ok.id);
  assert.equal(approved.reviewStatus, "APPROVED");
  assert.equal(approved.reviewTask?.status, "COMPLETED");
  assert.equal(approved.reviewTask?.decision, "APPROVED_CREATE");
  for (const untouched of [update, conflict, dup, noDate, matchFailed]) {
    const after = await reload(untouched.id);
    assert.equal(after.reviewStatus, "PENDING", untouched.externalId ?? "");
    assert.equal(after.reviewTask?.status, "PENDING");
  }
});

test("one failing record does not stop the rest, and a mapping problem is caught before any decision is saved", async () => {
  const bad = await record("Не соберётся");
  const fine = await record("Соберётся");
  const calls: string[] = [];
  const deps: BulkDeps = {
    ...publishOk(calls),
    validateMapping: async (data) => ((data as { title?: string }).title === "Не соберётся" ? "title is required" : null),
  };
  const results = await bulkPublishCreateNew([bad.id, fine.id], adminId, deps);
  assert.equal(results[0].outcome, "failed");
  assert.equal(results[0].reason, "title is required");
  assert.equal(results[1].outcome, "published");
  assert.equal((await reload(bad.id)).reviewStatus, "PENDING", "no decision for a record that cannot be built");

  // A publish failure after the decision is reported, not swallowed.
  const failing = await record("Публикация упадёт");
  const failDeps: BulkDeps = { ...publishOk([]), publish: (async () => ({ success: false, reason: "boom" })) as never };
  const [r] = await bulkPublishCreateNew([failing.id], adminId, failDeps);
  assert.deepEqual([r.outcome, r.reason], ["failed", "boom"]);
});

test("batch size is limited and an empty selection is an error", async () => {
  await assert.rejects(() => bulkPublishCreateNew([], adminId), /Не выбрано/);
  await assert.rejects(() => bulkRejectRecords([], adminId), /Не выбрано/);
  const tooMany = Array.from({ length: BULK_REVIEW_MAX + 1 }, (_, i) => `id-${i}`);
  await assert.rejects(() => bulkPublishCreateNew(tooMany, adminId), /не больше/);
  // Duplicate ids count once.
  assert.deepEqual((await bulkRejectRecords(["nope", "nope"], adminId)).map((r) => r.reason), ["not_found"]);
});

test("bulk reject closes open tasks and leaves decided records alone", async () => {
  const a = await record("Отклонить 1", { action: "MERGE" });
  const b = await record("Отклонить 2");
  const decided = await record("Уже одобрена", { reviewStatus: "APPROVED", taskStatus: "COMPLETED" });

  const results = await bulkRejectRecords([a.id, b.id, decided.id], adminId);
  assert.deepEqual(results.map((r) => r.outcome), ["rejected", "rejected", "skipped"]);
  assert.equal(results[2].reason, "already_decided");
  for (const id of [a.id, b.id]) {
    const after = await reload(id);
    assert.equal(after.reviewStatus, "REJECTED");
    assert.equal(after.reviewTask?.status, "COMPLETED");
    assert.equal(after.reviewTask?.decision, "REJECTED");
  }
  assert.equal((await reload(decided.id)).reviewStatus, "APPROVED");
});

test("real publish creates a moderated event and links the record", async () => {
  const r = await record("Реальная публикация");
  const [result] = await bulkPublishCreateNew([r.id], adminId);
  assert.equal(result.outcome, "published", result.reason);
  assert.ok(result.activityId);
  activityIds.push(result.activityId!);

  const activity = await prisma.activity.findUniqueOrThrow({ where: { id: result.activityId! }, select: { status: true, title: true } });
  assert.equal(activity.status, "PENDING", "created for moderation, not live");
  assert.equal(activity.title, "Реальная публикация");
  const after = await reload(r.id);
  assert.equal(after.publishedActivityId, result.activityId);
  assert.equal(after.reviewStatus, "APPROVED");

  // Running it again does nothing: the record is already linked.
  const [again] = await bulkPublishCreateNew([r.id], adminId);
  assert.deepEqual([again.outcome, again.reason], ["skipped", "already_linked"]);
});
