import assert from "node:assert/strict";
import test from "node:test";
import { CollectionLeadError, submitCollectionLead, type CollectionLeadProgress } from "./collectionLeadApi";
import {
  clampChildren, DEFAULT_LEAD_FORM, earliestLeadDate, initialLeadForm, LEAD_DRAFT_TTL_MS, parseLeadDraft, serializeLeadDraft,
  suggestLeadDates, validateLeadForm, withLeadReturnParam, type CollectionLeadForm,
} from "./collectionLeadForm";

const NOW = new Date("2026-11-06T09:00:00Z");
const limits = { minChildren: 5, maxChildren: 15 };
const ok: CollectionLeadForm = { ...DEFAULT_LEAD_FORM, eventDate: "2026-11-15", children: 10, contactName: "Анна", contactPhone: "+375 29 123-45-67" };

test("valid form has no errors", () => {
  assert.deepEqual(validateLeadForm(ok, limits, NOW), {});
});

test("date must be later than 24 hours ahead", () => {
  assert.ok(validateLeadForm({ ...ok, eventDate: "2026-11-07" }, limits, NOW).eventDate);
  assert.ok(validateLeadForm({ ...ok, eventDate: "" }, limits, NOW).eventDate);
  assert.equal(validateLeadForm({ ...ok, eventDate: "2026-11-09" }, limits, NOW).eventDate, undefined);
});

test("children respect offer capacity", () => {
  assert.match(validateLeadForm({ ...ok, children: 3 }, limits, NOW).children ?? "", /Минимум 5/);
  assert.match(validateLeadForm({ ...ok, children: 20 }, limits, NOW).children ?? "", /Не больше 15/);
  assert.equal(clampChildren(2, limits), 5);
  assert.equal(clampChildren(99, limits), 15);
  assert.equal(initialLeadForm(limits).children, 8);
});

test("time order, contact name and phone are required", () => {
  assert.ok(validateLeadForm({ ...ok, timeTo: "11:00" }, limits, NOW).timeTo);
  assert.ok(validateLeadForm({ ...ok, contactName: "  " }, limits, NOW).contactName);
  assert.ok(validateLeadForm({ ...ok, contactPhone: "+375" }, limits, NOW).contactPhone);
});

test("draft survives within ttl and expires after", () => {
  const raw = serializeLeadDraft(ok, 1_000);
  assert.deepEqual(parseLeadDraft(raw, 1_000 + 1000), ok);
  assert.equal(parseLeadDraft(raw, 1_000 + LEAD_DRAFT_TTL_MS + 1), null);
  assert.equal(parseLeadDraft("{bad", 5), null);
  assert.equal(parseLeadDraft(null), null);
});

test("return marker is added without losing the existing query", () => {
  assert.equal(withLeadReturnParam("/minsk/blog/x?utm=1", "o1"), "/minsk/blog/x?utm=1&leadOffer=o1");
  assert.equal(withLeadReturnParam("/minsk/blog/x", "o1"), "/minsk/blog/x?leadOffer=o1");
});

function fakeFetch(plan: Array<{ status: number; body: unknown }>) {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const impl = async (url: string, init?: RequestInit) => {
    calls.push({ url, init });
    const step = plan.shift()!;
    return new Response(JSON.stringify(step.body), { status: step.status });
  };
  return { calls, impl };
}

test("submit runs draft → patch → submit with idempotency key", async () => {
  const { calls, impl } = fakeFetch([
    { status: 201, body: { id: "p1", version: 0 } },
    { status: 200, body: { id: "p1", version: 1 } },
    { status: 201, body: { request: { id: "r1" } } },
  ]);
  const progress = { idempotencyKey: "k1" };
  const res = await submitCollectionLead({ offerId: "o1", citySlug: "minsk", mode: "PACKAGE", form: { ...ok, comment: " торт свой " }, progress, fetchImpl: impl });
  assert.deepEqual(res, { partyId: "p1", requestId: "r1" });
  assert.deepEqual(calls.map((c) => c.url), ["/api/parent/parties", "/api/parent/parties/p1", "/api/parent/parties/p1/submit"]);
  const patch = JSON.parse(String(calls[1].init?.body));
  assert.equal(patch.version, 0);
  assert.equal(patch.anchorOfferId, "o1");
  assert.deepEqual(patch.addonOfferIds, []);
  assert.equal(patch.anchorNote, "торт свой");
  assert.equal((calls[2].init?.headers as Record<string, string>)["Idempotency-Key"], "k1");
  assert.equal(JSON.parse(String(calls[2].init?.body)).version, 1);
});

test("retry after a failed step reuses the created draft", async () => {
  const progress: CollectionLeadProgress = { idempotencyKey: "k2" };
  const first = fakeFetch([
    { status: 201, body: { id: "p2", version: 0 } },
    { status: 422, body: { error: "Выбранный исполнитель больше не доступен" } },
  ]);
  await assert.rejects(
    () => submitCollectionLead({ offerId: "o1", citySlug: "minsk", mode: "VENUE", form: ok, progress, fetchImpl: first.impl }),
    (e: unknown) => e instanceof CollectionLeadError && e.status === 422,
  );
  assert.equal(progress.partyId, "p2");
  const second = fakeFetch([
    { status: 200, body: { id: "p2", status: "DRAFT", version: 0 } },
    { status: 200, body: { version: 1 } },
    { status: 201, body: { request: { id: "r2" } } },
  ]);
  await submitCollectionLead({ offerId: "o1", citySlug: "minsk", mode: "VENUE", form: ok, progress, fetchImpl: second.impl });
  assert.deepEqual(second.calls.map((c) => c.init?.method), ["GET", "PATCH", "POST"]);
  assert.equal(second.calls[0].url, "/api/parent/parties/p2");
});

test("lost submit response: retry skips the patch and reuses the same idempotency key", async () => {
  const progress: CollectionLeadProgress = { idempotencyKey: "k3", partyId: "p3", version: 1 };
  const { calls, impl } = fakeFetch([
    { status: 200, body: { id: "p3", status: "ANCHOR_PENDING", version: 2 } },
    { status: 200, body: { request: { id: "r3" } } },
  ]);
  const res = await submitCollectionLead({ offerId: "o1", citySlug: "minsk", mode: "HOME", form: ok, progress, fetchImpl: impl });
  assert.deepEqual(res, { partyId: "p3", requestId: "r3" });
  assert.deepEqual(calls.map((c) => c.init?.method), ["GET", "POST"]);
  assert.equal((calls[1].init?.headers as Record<string, string>)["Idempotency-Key"], "k3");
  assert.equal(JSON.parse(String(calls[1].init?.body)).version, 2);
});

test("lost patch response: retry refreshes a stale version from the server", async () => {
  const progress: CollectionLeadProgress = { idempotencyKey: "k4", partyId: "p4", version: 0 };
  const { calls, impl } = fakeFetch([
    { status: 200, body: { id: "p4", status: "DRAFT", version: 1 } },
    { status: 200, body: { version: 2 } },
    { status: 201, body: { request: { id: "r4" } } },
  ]);
  await submitCollectionLead({ offerId: "o1", citySlug: "minsk", mode: "HOME", form: ok, progress, fetchImpl: impl });
  assert.equal(JSON.parse(String(calls[1].init?.body)).version, 1);
});

test("calendar minimum is the day of the 24h boundary, tomorrow stays selectable", () => {
  assert.equal(earliestLeadDate(new Date("2026-11-06T06:00:00Z")), "2026-11-07");
  assert.equal(validateLeadForm({ ...ok, eventDate: "2026-11-07", timeFrom: "12:00", timeTo: "14:00" }, limits, new Date("2026-11-06T06:00:00Z")).eventDate, undefined);
  assert.ok(validateLeadForm({ ...ok, eventDate: "2026-11-07", timeFrom: "09:00", timeTo: "11:00" }, limits, new Date("2026-11-06T06:00:00Z")).eventDate);
});

test("401 is surfaced as an error with status for the login redirect", async () => {
  const { impl } = fakeFetch([{ status: 401, body: { error: "Требуется вход" } }]);
  await assert.rejects(
    () => submitCollectionLead({ offerId: "o1", citySlug: "minsk", mode: "HOME", form: ok, progress: { idempotencyKey: "k" }, fetchImpl: impl }),
    (e: unknown) => e instanceof CollectionLeadError && e.status === 401,
  );
});

import { collectionPrimaryAction } from "./collectionCardCta";

test("lead button only for party offers; other CTAs unchanged", () => {
  const base = { ctaMode: "details" as const, ctaPhone: null, ctaHref: null, schedulePreview: [] };
  const party = { mode: "PACKAGE" as const, citySlug: "minsk", minChildren: null, maxChildren: null };
  assert.equal(collectionPrimaryAction({ ...base, party }), "lead");
  assert.equal(collectionPrimaryAction({ ...base, party: null }), "details");
  assert.equal(collectionPrimaryAction({ ...base, ctaMode: "phone", ctaPhone: "+375291112233" }), "phone");
  assert.equal(collectionPrimaryAction({ ...base, ctaMode: "external", ctaHref: "https://x.by" }), "external");
  assert.equal(collectionPrimaryAction({ ...base, ctaMode: "camp-shift", schedulePreview: [{ shiftId: "s" }] }), "camp-shift");
  assert.equal(collectionPrimaryAction({ ...base, ctaMode: "camp-shift" }), "details");
});

test("date chips are upcoming weekends, none inside the 24h window", () => {
  // Пт 2026-11-06 12:00 по Минску → ближайшая допустимая суббота 2026-11-07 12:00 уже ближе 24 ч? Нет, ровно 24 ч — граница строгая.
  const now = new Date("2026-11-06T09:00:00Z");
  const chips = suggestLeadDates(now, 4);
  assert.equal(chips.length, 4);
  assert.ok(chips.every((c) => ["сб", "вс"].includes(c.weekday)));
  assert.ok(chips.every((c) => validateLeadForm({ ...DEFAULT_LEAD_FORM, eventDate: c.iso, contactName: "А", contactPhone: "+375291234567", children: 5 }, { minChildren: null, maxChildren: null }, now).eventDate === undefined));
  assert.deepEqual(chips.map((c) => c.iso), [...chips.map((c) => c.iso)].sort());
  assert.equal(new Set(chips.map((c) => c.iso)).size, 4);
});

test("date chips skip a weekend day that is less than 24h away", () => {
  const now = new Date("2026-11-07T10:00:00Z"); // сб 13:00 по Минску → сб уже нельзя, вс 12:00 меньше чем через 24 ч нельзя
  const first = suggestLeadDates(now, 1)[0];
  assert.equal(first?.iso, "2026-11-14");
});

test("child name travels to the party draft", async () => {
  const { calls, impl } = fakeFetch([
    { status: 201, body: { id: "p9", version: 0 } },
    { status: 200, body: { version: 1 } },
    { status: 201, body: { request: { id: "r9" } } },
  ]);
  await submitCollectionLead({ offerId: "o1", citySlug: "minsk", mode: "HOME", form: { ...ok, childName: " Степа ", childAge: 7 }, progress: { idempotencyKey: "k9" }, fetchImpl: impl });
  const patch = JSON.parse(String(calls[1].init?.body));
  assert.equal(patch.childName, "Степа");
  assert.equal(patch.childAge, 7);
});
