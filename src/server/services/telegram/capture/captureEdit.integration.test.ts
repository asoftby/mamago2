/**
 * Integration test for the capture edit flow (a user corrects a draft with a
 * text message) against a scratch Postgres. OpenRouter, the presenter and the
 * notifier are mocked: no network, no live model calls.
 *
 * It pins the model-call behaviour of the edit service: fast model, one retry,
 * one escalation to the strong model, usage accounting and the machine failure
 * path. The behaviour must not change when the service moves onto the shared
 * extraction module.
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test, { after, before } from "node:test";
import { PrismaClient } from "@prisma/client";
import type { CaptureModelConfig, OpenRouterCallInput, OpenRouterCallResult } from "@/lib/ai/openrouterClient";
import { getPublicPublishedPlaceWhere } from "@/server/public/publicContentVisibility";
import { createCaptureEditService } from "./captureEdit.service";
import { draft, entry } from "./captureDraft.testkit";
import { RULE_CODES } from "./captureRules";
import type { ParsedCapture } from "./telegramUpdateParser";

const db = new PrismaClient();
const run = randomUUID().slice(0, 8);
const FAST = "vendor/fast";
const STRONG = "vendor/strong";
const userId = `edit-${run}-user`;
let countryId = "";
let cityId = "";
let seq = 0;

type Reply = OpenRouterCallResult;
const ok = (payload: unknown, model: string): Reply => ({
  ok: true,
  content: typeof payload === "string" ? payload : JSON.stringify(payload),
  model,
  tokensIn: 10,
  tokensOut: 5,
});
const infra = (retryable: boolean): Reply => ({ ok: false, code: retryable ? "OPENROUTER_HTTP_5XX" : "OPENROUTER_HTTP_4XX", retryable });
const badResponse = (): Reply => ({ ok: false, code: "OPENROUTER_BAD_RESPONSE", retryable: true });
const notConfigured = (): Reply => ({ ok: false, code: "OPENROUTER_NOT_CONFIGURED", retryable: false });

const edited = (title = "Новое название") => ({
  ...draft(),
  entries: [entry({ title: { value: title, state: "stated" } })],
});
const intentChanged = () => ({ ...draft(), intent: "CANCEL", entries: [] });

const FAILURE_TEXT = "Не получилось применить правку. Нажмите «Изменить» и попробуйте ещё раз.";

async function makeItem() {
  return db.inboxItem.create({
    data: {
      userId,
      environment: "DEV",
      telegramChatId: BigInt(1),
      sourceKind: "FORWARD",
      anchorAt: new Date("2026-10-06T10:00:00Z"),
      anchorIsForward: true,
      debounceUntil: new Date(),
      status: "DRAFT_READY",
      intent: "CREATE",
      draft: draft() as object,
      draftVersion: 1,
      awaitingEditUntil: new Date(Date.now() + 10 * 60_000),
      purgeAfter: new Date(Date.now() + 86_400_000),
    },
  });
}

async function edit(script: Reply[], models: CaptureModelConfig) {
  const item = await makeItem();
  const calls: OpenRouterCallInput[] = [];
  const queue = [...script];
  const replies: string[] = [];
  const presented: string[] = [];
  const service = createCaptureEditService({
    db,
    openrouter: {
      async chat(input) {
        calls.push(input);
        const next = queue.shift();
        assert.ok(next, "unexpected extra model call");
        return next.ok ? { ...next, model: input.model } : next;
      },
    },
    models: () => models,
    context: { db, city: { findCityIdBySlug: async () => cityId }, places: { publicPlaceWhere: getPublicPublishedPlaceWhere() } },
    presenter: { present: async (id: string) => { presented.push(id); } } as never,
    notifier: { typing: async () => undefined, reply: async (_chat: number, text: string) => { replies.push(text); } },
  });
  const capture: ParsedCapture = {
    kind: "capture", updateId: Date.now() * 1000 + ++seq, chatId: 1, fromUserId: 1, messageId: 100 + seq,
    partKind: "TEXT", text: "переименуй в новое название", fileId: null, photoTooLarge: false, mediaGroupId: null,
    sourceKind: "FORWARD", anchorAt: new Date("2026-10-06T12:00:00Z"), anchorIsForward: false,
  };
  const received = await service.tryReceive({ userId }, "DEV", capture);
  assert.ok(received?.handled && received.afterResponse, "the edit is claimed");
  await received.afterResponse();
  assert.equal(queue.length, 0, "every scripted reply was used");
  return { item, calls, replies, presented, after: await db.inboxItem.findUniqueOrThrow({ where: { id: item.id } }) };
}

const both: CaptureModelConfig = { fast: FAST, strong: STRONG, responseFormat: "json_object" };
const fastOnly: CaptureModelConfig = { fast: FAST, strong: null, responseFormat: "json_object" };
const titleOf = (draftJson: unknown) => (draftJson as { entries: { title: { value: string } }[] }).entries[0].title.value;

before(async () => {
  await db.user.create({ data: { id: userId, email: `${userId}@example.test` } });
  countryId = (await db.country.create({ data: { name: `E ${run}`, slug: `e-${run}` } })).id;
  cityId = (await db.city.create({ data: { countryId, name: `E city ${run}`, slug: `e-city-${run}` } })).id;
});

after(async () => {
  await db.inboxItem.deleteMany({ where: { userId } });
  await db.city.deleteMany({ where: { id: cityId } });
  await db.country.deleteMany({ where: { id: countryId } });
  await db.user.deleteMany({ where: { id: userId } });
  await db.$disconnect();
});

test("a valid first answer is applied: version bump, usage, presenter", async () => {
  const h = await edit([ok(edited(), FAST)], both);
  assert.deepEqual(h.calls.map((c) => c.model), [FAST]);
  assert.equal(titleOf(h.after.draft), "Новое название");
  assert.equal(h.after.draftVersion, 2);
  assert.equal(h.after.editCount, 1);
  assert.equal(h.after.escalated, false);
  assert.equal(h.after.model, FAST);
  assert.deepEqual([h.after.tokensIn, h.after.tokensOut], [10, 5]);
  assert.equal(h.after.error, null);
  assert.deepEqual(h.presented, [h.item.id]);
  assert.equal(h.replies.length, 1, "only the \"accepted\" reply, no failure text");
  assert.ok(!h.replies.includes(FAILURE_TEXT));
});

test("invalid JSON is retried once on the fast model; both answers count as usage", async () => {
  const h = await edit([ok("not json", FAST), ok(edited(), FAST)], both);
  assert.deepEqual(h.calls.map((c) => c.model), [FAST, FAST]);
  assert.equal(h.after.escalated, false);
  assert.ok(!h.after.ruleCodes.includes(RULE_CODES.escalateInvalidJson));
  assert.deepEqual([h.after.tokensIn, h.after.tokensOut], [20, 10]);
});

test("a retryable provider error is retried once on the fast model", async () => {
  const h = await edit([infra(true), ok(edited(), FAST)], both);
  assert.deepEqual(h.calls.map((c) => c.model), [FAST, FAST]);
  assert.deepEqual([h.after.tokensIn, h.after.tokensOut], [10, 5], "failed provider calls report no tokens");
  assert.equal(h.after.draftVersion, 2);
});

test("invalid output twice escalates once to the strong model", async () => {
  const h = await edit([ok("nope", FAST), ok("nope", FAST), ok(edited("Сильная модель"), STRONG)], both);
  assert.deepEqual(h.calls.map((c) => c.model), [FAST, FAST, STRONG]);
  assert.equal(titleOf(h.after.draft), "Сильная модель");
  assert.equal(h.after.escalated, true);
  assert.ok(h.after.ruleCodes.includes(RULE_CODES.escalateInvalidJson));
  assert.equal(h.after.model, STRONG);
  assert.deepEqual([h.after.tokensIn, h.after.tokensOut], [30, 15]);
});

test("a bad provider response twice escalates to the strong model with its own rule code", async () => {
  const h = await edit([badResponse(), badResponse(), ok(edited("После сбоя"), STRONG)], both);
  assert.deepEqual(h.calls.map((c) => c.model), [FAST, FAST, STRONG]);
  assert.equal(h.after.escalated, true);
  assert.ok(h.after.ruleCodes.includes(RULE_CODES.escalateBadResponse));
  assert.ok(!h.after.ruleCodes.includes(RULE_CODES.escalateInvalidJson));
  assert.equal(titleOf(h.after.draft), "После сбоя");
});

// ── Failures: the draft is untouched, the edit window is reopened, the user is told ───────

async function assertFailed(h: Awaited<ReturnType<typeof edit>>) {
  assert.equal(h.after.draftVersion, 1, "the draft is not changed");
  assert.equal(h.after.editCount, 0);
  assert.equal(titleOf(h.after.draft), "Экскурсия в музей");
  assert.ok(h.after.awaitingEditUntil && h.after.awaitingEditUntil.getTime() > Date.now(), "the edit window is reopened");
  assert.ok(h.replies.includes(FAILURE_TEXT), "the user gets the failure text");
  assert.deepEqual(h.presented, [], "no card is shown");
  assert.equal(h.after.escalated, false);
}

test("a provider error twice fails without escalating", async () => {
  const h = await edit([infra(true), infra(true)], both);
  assert.deepEqual(h.calls.map((c) => c.model), [FAST, FAST]);
  await assertFailed(h);
});

test("a non-retryable provider error fails after one call", async () => {
  const h = await edit([infra(false)], both);
  assert.deepEqual(h.calls.map((c) => c.model), [FAST]);
  await assertFailed(h);
});

test("a bad response twice without a strong model fails", async () => {
  const h = await edit([badResponse(), badResponse()], fastOnly);
  assert.deepEqual(h.calls.map((c) => c.model), [FAST, FAST]);
  await assertFailed(h);
});

test("invalid output twice without a strong model fails", async () => {
  const h = await edit([ok("nope", FAST), ok("nope", FAST)], fastOnly);
  assert.deepEqual(h.calls.map((c) => c.model), [FAST, FAST]);
  await assertFailed(h);
});

test("the strong model failing too ends the edit", async () => {
  const invalidStrong = await edit([ok("nope", FAST), ok("nope", FAST), ok("still nope", STRONG)], both);
  assert.deepEqual(invalidStrong.calls.map((c) => c.model), [FAST, FAST, STRONG]);
  await assertFailed(invalidStrong);

  const infraStrong = await edit([badResponse(), badResponse(), infra(false)], both);
  assert.deepEqual(infraStrong.calls.map((c) => c.model), [FAST, FAST, STRONG]);
  await assertFailed(infraStrong);
});

test("no configured model: nothing is called; a provider that reports it is not retried", async () => {
  const none = await edit([], { fast: null, strong: null, responseFormat: "json_object" });
  assert.equal(none.calls.length, 0);
  await assertFailed(none);

  const reported = await edit([notConfigured()], both);
  assert.deepEqual(reported.calls.map((c) => c.model), [FAST]);
  await assertFailed(reported);
});

test("an answer that changes the draft intent is rejected", async () => {
  const h = await edit([ok(intentChanged(), FAST)], both);
  assert.deepEqual(h.calls.map((c) => c.model), [FAST]);
  await assertFailed(h);
});
