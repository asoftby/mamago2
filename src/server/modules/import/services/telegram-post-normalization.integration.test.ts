/**
 * Нормализатор постов канала на реальной БД с подставной моделью
 * (гоняется через scripts/git/gate-env.sh на одноразовом Postgres).
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test, { after, before } from "node:test";
import prisma from "@/lib/prisma";
import type { OpenRouterCallInput, OpenRouterCallResult } from "@/lib/ai/openrouterClient";
import { createTelegramPostNormalizer, setTelegramPostNormalizerForTests } from "./telegram-post-normalization.service";
import { normalizeRunRecords } from "./import-normalization.service";
import { describePostponed, summarizeNormalization } from "./normalization-notes";
import { ensureImportReviewTaskExists } from "./import-review-task.service";

const tag = randomUUID().slice(0, 8);
const NOW = new Date("2026-10-30T12:00:00Z");
let sourceId = "";
let seq = 0;

const f = (value: string | null, state: "stated" | "inferred" | "missing" = "stated") => ({ value, state: value ? state : "missing", from: value ? "TEXT" : null });
const ev = (over: Record<string, unknown> = {}) => ({
  title: f("Мастер-класс по лепке"),
  summary: "Лепка из глины для детей и родителей.",
  venueName: f("Арт-студия Сирень"),
  addressText: f("ул. М. Богдановича, 132"),
  cityName: f("Минск"),
  addressNote: null,
  occurrences: [{ startAt: f("2026-11-08T14:00:00+03:00"), title: null }],
  ageText: f(null),
  audienceHint: null,
  price: { value: "20 руб.", isFree: false, state: "stated", from: "TEXT" },
  registration: { required: null, url: null, method: null, from: null },
  ticketsUrl: null,
  socialUrls: [],
  categoryCandidates: ["мастер-класс"],
  conflicts: [],
  confidence: { dates: 0.9, venue: 0.9, age: 0.2 },
  ...over,
});
const postJson = (postKind: string, events: unknown[]) => JSON.stringify({ postKind, images: [], events });

type Script = (input: OpenRouterCallInput) => OpenRouterCallResult;
const ok = (content: string): OpenRouterCallResult => ({ ok: true, content, model: "m", tokensIn: 10, tokensOut: 5 });

function normalizer(script: Script, opts: { fast?: string | null; strong?: string | null; imageOk?: boolean } = {}) {
  const calls: OpenRouterCallInput[] = [];
  const n = createTelegramPostNormalizer({
    openrouter: { chat: async (input) => { calls.push(input); return script(input); } },
    models: () => ({ fast: opts.fast === undefined ? "fast" : opts.fast, strong: opts.strong === undefined ? "strong" : opts.strong, responseFormat: "json_object" }),
    loadImage: async () => opts.imageOk === false
      ? { ok: false, code: "IMAGE_FETCH_FAILED" }
      : { ok: true, value: { bytes: new Uint8Array([1, 2, 3]), mime: "image/jpeg", sha256: "a".repeat(64), origin: "web" } },
    detectCategory: async () => null,
    now: () => NOW,
  });
  return { n, calls };
}

async function newRun() {
  return prisma.importRun.create({ data: { source: { connect: { id: sourceId } }, status: "RUNNING", startedAt: NOW } });
}

async function newRecord(over: { text?: string; poll?: boolean; images?: number; externalId?: string; runId?: string } = {}) {
  const id = ++seq;
  const record = await prisma.importedRecord.create({
    data: {
      sourceId,
      runId: over.runId,
      externalId: over.externalId ?? `chan_${tag}/${1000 + id}`,
      sourceUrl: `https://t.me/chan_${tag}/${1000 + id}`,
      entityTypeHint: "EVENT",
      contentHash: `hash-${id}`,
      parseStatus: "SUCCESS",
      rawPayload: {
        channel: `chan_${tag}`,
        text: over.text ?? "Мастер-класс по лепке 8 ноября в 14:00, Арт-студия Сирень, 20 руб.",
        links: [],
        hashtags: [],
        postedAt: "2026-10-29T10:00:00+00:00",
        flags: { poll: over.poll ?? false },
        images: Array.from({ length: over.images ?? 0 }, (_, i) => ({ url: `https://cdn4.telesco.pe/file/${id}-${i}.jpg`, sha256: null })),
      },
    },
  });
  await ensureImportReviewTaskExists(record.id);
  return record;
}

const reload = (id: string) => prisma.importedRecord.findUniqueOrThrow({ where: { id }, include: { reviewTask: true } });

before(async () => {
  const source = await prisma.importSource.create({
    data: { name: `tg ${tag}`, slug: `tg-${tag}`, type: "TELEGRAM_CHANNEL", fetchStrategy: "TELEGRAM_WEB_PREVIEW", parserKey: "telegram-channel-event", defaultEntity: "EVENT", aiCallBudgetPerRun: 5 },
  });
  sourceId = source.id;
});

after(async () => {
  await prisma.importedRecord.deleteMany({ where: { sourceId } });
  await prisma.importRun.deleteMany({ where: { sourceId } });
  await prisma.importSource.delete({ where: { id: sourceId } });
  await prisma.$disconnect();
});

test("an event post becomes a normalized record and run usage is counted", async () => {
  const run = await newRun();
  const record = await newRecord({ runId: run.id, images: 2 });
  const { n, calls } = normalizer(() => ok(postJson("EVENT", [ev()])));

  assert.deepEqual(await n.normalize(record.id, { runId: run.id }), { status: "normalized", events: 1 });
  const after = await reload(record.id);
  assert.equal(after.normalizeStatus, "SUCCESS");
  assert.equal((after.normalizedData as { title: string }).title, "Мастер-класс по лепке");
  assert.equal((after.qualityFlags as { postKind: string; source: string }).postKind, "EVENT");
  assert.equal((after.qualityFlags as { source: string }).source, "telegram");
  assert.equal(after.reviewTask?.status, "PENDING", "the editor still decides");
  assert.equal(calls.length, 1);
  const parts = calls[0].userParts;
  assert.equal(parts.filter((p) => p.type === "image_url").length, 2, "both photos go to the model");

  const usage = await prisma.importRun.findUniqueOrThrow({ where: { id: run.id } });
  assert.equal(usage.aiCalls, 2, "one extraction call plus one category-detection call");
  assert.equal(usage.aiTokensIn, 10);
  assert.equal(usage.aiTokensOut, 5);
});

test("polls and empty posts never reach the model and close their review task", async () => {
  const poll = await newRecord({ poll: true });
  const empty = await newRecord({ text: "   " });
  const { n, calls } = normalizer(() => assert.fail("model must not be called"));

  assert.deepEqual(await n.normalize(poll.id), { status: "skipped", reason: "poll" });
  assert.deepEqual(await n.normalize(empty.id), { status: "skipped", reason: "empty_post" });
  assert.equal(calls.length, 0);
  for (const [record, reason] of [[poll, "poll"], [empty, "empty_post"]] as const) {
    const after = await reload(record.id);
    assert.equal(after.normalizeStatus, "SKIPPED");
    assert.equal(after.matchStatus, "SKIPPED");
    assert.equal(after.reviewTask?.status, "CANCELLED");
    assert.equal(after.reviewStatus, "SKIPPED");
    assert.equal((after.qualityFlags as { skipReason: string }).skipReason, reason);
  }
});

test("a NOT_EVENT post is skipped and its review task closed", async () => {
  const record = await newRecord({ text: "Розыгрыш завершён, победитель объявлен" });
  const { n } = normalizer(() => ok(postJson("NOT_EVENT", [])));
  assert.deepEqual(await n.normalize(record.id), { status: "skipped", reason: "not_event" });
  const after = await reload(record.id);
  assert.equal(after.normalizeStatus, "SKIPPED");
  assert.equal(after.reviewTask?.status, "CANCELLED");
});

test("a past event is skipped but keeps what was read for inspection", async () => {
  const record = await newRecord();
  const past = ev({ occurrences: [{ startAt: f("2026-10-01T10:00:00+03:00"), title: null }] });
  const { n } = normalizer(() => ok(postJson("EVENT", [past])));
  assert.deepEqual(await n.normalize(record.id), { status: "skipped", reason: "past_event" });
  const after = await reload(record.id);
  assert.equal(after.reviewTask?.status, "CANCELLED");
  assert.ok(after.normalizedData);
});

test("a digest becomes child records; the parent is closed as digest_split", async () => {
  const run = await newRun();
  const parent = await newRecord({ runId: run.id, externalId: `chan_${tag}/digest` });
  const two = [ev({ title: f("Чудо-юдо") }), ev({ title: f("Другое кино") })];
  const { n } = normalizer(() => ok(postJson("DIGEST", two)));

  assert.deepEqual(await n.normalize(parent.id, { runId: run.id }), { status: "normalized", events: 2 });
  const after = await reload(parent.id);
  assert.equal(after.normalizeStatus, "SKIPPED");
  assert.equal(after.reviewTask?.status, "CANCELLED");
  assert.equal((after.qualityFlags as { skipReason: string }).skipReason, "digest_split");

  const children = await prisma.importedRecord.findMany({
    where: { parentRecordId: parent.id },
    include: { reviewTask: true },
    orderBy: { externalId: "asc" },
  });
  assert.deepEqual(children.map((c) => c.externalId), [`chan_${tag}/digest#1`, `chan_${tag}/digest#2`]);
  for (const child of children) {
    assert.equal(child.normalizeStatus, "SUCCESS");
    assert.equal(child.entityTypeHint, "EVENT");
    assert.equal(child.runId, run.id, "children join the run so matching picks them up");
    assert.equal(child.reviewTask?.status, "PENDING");
  }
  assert.deepEqual(children.map((c) => (c.normalizedData as { title: string }).title), ["Чудо-юдо", "Другое кино"]);

  // The post is edited and now lists one event: the second child is closed, the first is updated.
  const { n: n2 } = normalizer(() => ok(postJson("DIGEST", [ev({ title: f("Чудо-юдо (обновлено)") })])));
  assert.deepEqual(await n2.normalize(parent.id, { runId: run.id }), { status: "normalized", events: 1 });
  const again = await prisma.importedRecord.findMany({ where: { parentRecordId: parent.id }, include: { reviewTask: true }, orderBy: { externalId: "asc" } });
  assert.equal((again[0].normalizedData as { title: string }).title, "Чудо-юдо (обновлено)");
  assert.equal(again[0].reviewTask?.status, "PENDING");
  assert.equal(again[1].normalizeStatus, "SKIPPED");
  assert.equal(again[1].reviewTask?.status, "CANCELLED");
});

test("an already reviewed digest child is not overwritten; the source change is flagged", async () => {
  const parent = await newRecord({ externalId: `chan_${tag}/decided` });
  const { n } = normalizer(() => ok(postJson("DIGEST", [ev({ title: f("Показ") })])));
  await n.normalize(parent.id);
  const child = await prisma.importedRecord.findFirstOrThrow({ where: { parentRecordId: parent.id } });
  await prisma.importedRecord.update({ where: { id: child.id }, data: { reviewStatus: "APPROVED" } });
  await prisma.importReviewTask.update({ where: { importedRecordId: child.id }, data: { status: "COMPLETED" } });

  const moved = ev({ title: f("Показ"), occurrences: [{ startAt: f("2026-11-20T10:00:00+03:00"), title: null }] });
  const { n: n2 } = normalizer(() => ok(postJson("DIGEST", [moved])));
  await n2.normalize(parent.id);

  const after = await reload(child.id);
  assert.equal((after.normalizedData as { startAt: string }).startAt, "2026-11-08T14:00:00+03:00", "the reviewed data is untouched");
  assert.deepEqual((after.qualityFlags as { sourceChanged: { fields: string[] } }).sourceChanged.fields, ["dates"]);
  assert.equal(after.reviewTask?.status, "PENDING", "the task is reopened for the editor");
});

test("the run budget postpones records without calling the model", async () => {
  const run = await newRun();
  await prisma.importRun.update({ where: { id: run.id }, data: { aiCalls: 5 } });
  const record = await newRecord({ runId: run.id });
  const { n, calls } = normalizer(() => assert.fail("model must not be called"));

  assert.deepEqual(await n.normalize(record.id, { runId: run.id }), { status: "postponed", reason: "budget" });
  assert.equal(calls.length, 0);
  const after = await reload(record.id);
  assert.equal(after.normalizeStatus, "PENDING", "picked up by the next run");
  assert.equal(after.reviewTask?.status, "PENDING");
});

test("without a configured model the record stays pending", async () => {
  const record = await newRecord();
  const { n, calls } = normalizer(() => assert.fail("no model"), { fast: null });
  assert.deepEqual(await n.normalize(record.id), { status: "postponed", reason: "model_not_configured" });
  assert.equal(calls.length, 0);
  assert.equal((await reload(record.id)).normalizeStatus, "PENDING");
});

test("invalid output is retried, escalated once, then fails with a machine code", async () => {
  const run = await newRun();
  const record = await newRecord({ runId: run.id });
  const { n, calls } = normalizer(() => ok("not json"));
  assert.deepEqual(await n.normalize(record.id, { runId: run.id }), { status: "failed", code: "AI_INVALID_OUTPUT" });
  assert.deepEqual(calls.map((c) => c.model), ["fast", "fast", "strong"]);
  const after = await reload(record.id);
  assert.equal(after.normalizeStatus, "FAILED");
  assert.equal(after.errorMessage, "AI_INVALID_OUTPUT", "only a machine code is stored, never provider text");
  assert.equal((await prisma.importRun.findUniqueOrThrow({ where: { id: run.id } })).aiCalls, 3);
});

test("a post with only unreachable images and no text fails without a model call", async () => {
  const record = await newRecord({ text: "", images: 2 });
  const { n, calls } = normalizer(() => assert.fail("model must not be called"), { imageOk: false });
  assert.deepEqual(await n.normalize(record.id), { status: "failed", code: "IMAGES_UNAVAILABLE" });
  assert.equal(calls.length, 0);
});

test("a poster-only post (no text) goes to the model with its images", async () => {
  const record = await newRecord({ text: "", images: 1 });
  const poster = ev({ title: { value: "Афиша", state: "stated", from: "IMAGE:0" } });
  const { n, calls } = normalizer(() => ok(postJson("EVENT", [poster])));
  assert.deepEqual(await n.normalize(record.id), { status: "normalized", events: 1 });
  assert.equal(calls[0].userParts.filter((p) => p.type === "image_url").length, 1);
});

// ── Review-found cases ──────────────────────────────────────────────────────

test("an auto-skipped post returns to the review queue when an edit makes it valid", async () => {
  const record = await newRecord();
  const noDate = ev({ occurrences: [] });
  const { n } = normalizer(() => ok(postJson("EVENT", [noDate])));
  assert.deepEqual(await n.normalize(record.id), { status: "skipped", reason: "incomplete" });
  const skipped = await reload(record.id);
  assert.equal(skipped.reviewTask?.status, "CANCELLED");
  assert.equal(skipped.reviewStatus, "SKIPPED");

  // The post is edited and now carries a date.
  const { n: n2 } = normalizer(() => ok(postJson("EVENT", [ev()])));
  assert.deepEqual(await n2.normalize(record.id), { status: "normalized", events: 1 });
  const back = await reload(record.id);
  assert.equal(back.normalizeStatus, "SUCCESS");
  assert.equal(back.reviewTask?.status, "PENDING");
  assert.equal(back.reviewStatus, "PENDING");
});

test("an editor's decision is not reopened by renormalization", async () => {
  const record = await newRecord();
  const { n } = normalizer(() => ok(postJson("EVENT", [ev()])));
  await n.normalize(record.id);
  // The editor rejected it: the task is closed by a person, not by the automation.
  await prisma.importReviewTask.update({ where: { importedRecordId: record.id }, data: { status: "COMPLETED", notes: "not suitable" } });
  await prisma.importedRecord.update({ where: { id: record.id }, data: { reviewStatus: "REJECTED" } });

  await n.normalize(record.id);
  const after = await reload(record.id);
  assert.equal(after.reviewTask?.status, "COMPLETED");
  assert.equal(after.reviewStatus, "REJECTED");
});

test("a digest child that was auto-closed comes back when the post is fixed", async () => {
  const parent = await newRecord({ externalId: `chan_${tag}/digest-fix` });
  const two = [ev({ title: f("Первое") }), ev({ title: f("Второе") })];
  await normalizer(() => ok(postJson("DIGEST", two))).n.normalize(parent.id);

  // Second item loses its date: its child record is closed.
  const broken = [ev({ title: f("Первое") }), ev({ title: f("Второе"), occurrences: [] })];
  await normalizer(() => ok(postJson("DIGEST", broken))).n.normalize(parent.id);
  const closed = await prisma.importedRecord.findUniqueOrThrow({
    where: { sourceId_externalId: { sourceId, externalId: `chan_${tag}/digest-fix#2` } },
    include: { reviewTask: true },
  });
  assert.equal(closed.reviewTask?.status, "CANCELLED");

  // The date is added back: the child returns to the queue.
  await normalizer(() => ok(postJson("DIGEST", two))).n.normalize(parent.id);
  const reopened = await prisma.importedRecord.findUniqueOrThrow({ where: { id: closed.id }, include: { reviewTask: true } });
  assert.equal(reopened.normalizeStatus, "SUCCESS");
  assert.equal(reopened.reviewTask?.status, "PENDING");
  assert.equal(reopened.reviewStatus, "PENDING");
});

test("the budget is checked before every model call, retries and escalation included", async () => {
  const run = await newRun();
  await prisma.importRun.update({ where: { id: run.id }, data: { aiCalls: 3 } }); // budget 5: two calls left
  const record = await newRecord({ runId: run.id });
  const { n, calls } = normalizer(() => ok("not json"));

  assert.deepEqual(await n.normalize(record.id, { runId: run.id }), { status: "postponed", reason: "budget" });
  assert.deepEqual(calls.map((c) => c.model), ["fast", "fast"], "the strong-model call is blocked, not made");
  const usage = await prisma.importRun.findUniqueOrThrow({ where: { id: run.id } });
  assert.equal(usage.aiCalls, 5, "the budget is never exceeded");
  assert.equal((await reload(record.id)).normalizeStatus, "PENDING", "picked up by the next run");
});

test("category detection also needs budget and is skipped without it", async () => {
  const run = await newRun();
  await prisma.importRun.update({ where: { id: run.id }, data: { aiCalls: 4 } }); // one call left
  const record = await newRecord({ runId: run.id });
  let categoryCalls = 0;
  const n = createTelegramPostNormalizer({
    openrouter: { chat: async () => ok(postJson("EVENT", [ev()])) },
    models: () => ({ fast: "fast", strong: null, responseFormat: "json_object" }),
    loadImage: async () => ({ ok: false, code: "IMAGE_FETCH_FAILED" }),
    detectCategory: async () => { categoryCalls++; return null; },
    now: () => NOW,
  });

  assert.deepEqual(await n.normalize(record.id, { runId: run.id }), { status: "normalized", events: 1 });
  assert.equal(categoryCalls, 0, "the last call went to extraction; category is optional and skipped");
  assert.equal((await prisma.importRun.findUniqueOrThrow({ where: { id: run.id } })).aiCalls, 5);
});

test("an edit that moves a published event into auto-skip still alerts the editor", async () => {
  const owner = await prisma.user.create({ data: { email: `tg-norm-${tag}@example.invalid` }, select: { id: true } });
  const activity = await prisma.activity.create({
    data: {
      ownerUserId: owner.id, title: `Published ${tag}`, shortDesc: "fixture", type: "EVENT", status: "PUBLISHED",
      scheduleMode: "ONE_TIME", schedulingKind: "SLOT", scheduleJson: { durationMinutes: 60 },
    },
    select: { id: true },
  });
  try {
    const record = await newRecord();
    const previous = { entityType: "EVENT", title: "Мастер-класс по лепке", startAt: "2026-11-08T14:00:00+03:00", occurrences: [{ startAt: "2026-11-08T14:00:00+03:00" }], sourceSlug: "x", sourceUrl: "u", categoryCandidates: [], imageUrls: [] };
    await prisma.importedRecord.update({
      where: { id: record.id },
      data: { publishedActivityId: activity.id, reviewStatus: "APPROVED", normalizeStatus: "PENDING", normalizedData: previous },
    });
    await prisma.importReviewTask.update({ where: { importedRecordId: record.id }, data: { status: "COMPLETED" } });

    // The post was edited: the date is now in the past.
    const past = ev({ occurrences: [{ startAt: f("2026-10-01T10:00:00+03:00"), title: null }] });
    const { n } = normalizer(() => ok(postJson("EVENT", [past])));
    assert.deepEqual(await n.normalize(record.id), { status: "skipped", reason: "past_event" });

    const after = await reload(record.id);
    assert.deepEqual((after.normalizedData as { title: string }).title, "Мастер-класс по лепке", "published data is kept");
    assert.equal(after.normalizeStatus, "SUCCESS");
    const changed = (after.qualityFlags as { sourceChanged: { fields: string[] } }).sourceChanged.fields;
    assert.ok(changed.includes("skip:past_event") && changed.includes("dates"), `changed: ${changed.join(",")}`);
    assert.equal(after.reviewTask?.status, "PENDING", "the editor is alerted");
    assert.equal(after.publishedActivityId, activity.id);
  } finally {
    await prisma.importedRecord.updateMany({ where: { publishedActivityId: activity.id }, data: { publishedActivityId: null } });
    await prisma.activity.delete({ where: { id: activity.id } });
    await prisma.user.delete({ where: { id: owner.id } });
  }
});

test("without a model the run keeps the posts and says why; the next run with a model picks them up", async () => {
  const run1 = await newRun();
  const a = await newRecord({ runId: run1.id, externalId: `chan_${tag}/backlog-a` });
  const b = await newRecord({ runId: run1.id, externalId: `chan_${tag}/backlog-b` });
  const isOurs = (r: { recordId: string }) => [a.id, b.id].includes(r.recordId);

  // Run 1: the model is not configured on the server.
  setTelegramPostNormalizerForTests(normalizer(() => assert.fail("no model call"), { fast: null }).n);
  const first = (await normalizeRunRecords(run1.id)).filter(isOurs);
  const summary = summarizeNormalization(first);
  assert.deepEqual([summary.success, summary.failed, summary.postponed], [0, 0, 2], "postponed is not an error");
  assert.deepEqual(summary.postponedReasons, ["model_not_configured"]);
  assert.match(describePostponed(summary, 5)!, /2 поста ждут нормализации\. Модель не настроена/);
  for (const r of [a, b]) {
    const after = await reload(r.id);
    assert.equal(after.normalizeStatus, "PENDING", "the post is kept, nothing is lost");
    assert.equal(after.normalizedData, null);
    assert.equal(after.runId, run1.id);
  }

  // Run 2: the model is configured now; there are no new posts, only the backlog.
  const run2 = await newRun();
  setTelegramPostNormalizerForTests(normalizer(() => ok(postJson("EVENT", [ev()]))).n);
  try {
    const second = (await normalizeRunRecords(run2.id)).filter(isOurs);
    assert.deepEqual([second.filter((r) => r.success).length, second.length], [2, 2]);
    for (const r of [a, b]) {
      const after = await reload(r.id);
      assert.equal(after.normalizeStatus, "SUCCESS");
      assert.equal((after.normalizedData as { title: string }).title, "Мастер-класс по лепке");
      assert.equal(after.runId, run2.id, "moved to the current run so matching sees it");
    }
  } finally {
    setTelegramPostNormalizerForTests(null);
  }
});
