import assert from "node:assert/strict";
import test from "node:test";
import { getEventTemporalState } from "@/lib/events/eventTemporalState";
import {
  isPublicationActive,
  resolvePublicationDisplayStatus as resolve,
} from "./displayStatus";

const NOW = new Date("2026-11-16T12:00:00Z");
const H = 3600_000;
const at = (ms: number) => new Date(NOW.getTime() + ms);
const temporal = (sessions: Date[], nextOccurrenceAt: Date | null = null) =>
  getEventTemporalState({ scheduleMode: "ONE_TIME" as never, nextOccurrenceAt, sessions: sessions.map((startsAt) => ({ startsAt })), now: NOW });

test("1 published future event is active", () => {
  const r = resolve({ status: "PUBLISHED", temporalState: temporal([at(24 * H)]) });
  assert.equal(r.label, "Активно");
  assert.equal(r.tone, "success");
});

test("2 ongoing/always event is active", () => {
  const t = getEventTemporalState({ scheduleMode: "ALWAYS", nextOccurrenceAt: null, now: NOW });
  assert.equal(resolve({ status: "PUBLISHED", temporalState: t }).key, "active");
});

test("3 finished event is past", () => {
  const r = resolve({ status: "PUBLISHED", temporalState: temporal([at(-48 * H)]) });
  assert.equal(r.label, "Прошло");
  assert.equal(r.tone, "muted");
});

test("4 multi-day event with future session stays active even if nextOccurrenceAt is stale", () => {
  const t = temporal([at(-72 * H), at(24 * H)], at(-72 * H));
  assert.equal(resolve({ status: "PUBLISHED", temporalState: t }).key, "active");
});

test("4b all sessions finished -> past", () => {
  assert.equal(resolve({ status: "PUBLISHED", temporalState: temporal([at(-72 * H), at(-24 * H)]) }).key, "past");
});

test("5 draft with past date stays draft", () => {
  assert.equal(resolve({ status: "DRAFT", temporalState: "PAST" }).label, "Черновик");
});

test("6 pending (incl. pending update) is on moderation", () => {
  assert.equal(resolve({ status: "PENDING", temporalState: "PAST" }).label, "На модерации");
  assert.equal(resolve({ status: "PENDING_UPDATE" }).key, "pending");
  assert.equal(resolve({ status: "PENDING" }).tone, "warning");
});

test("7 rejected", () => {
  const r = resolve({ status: "REJECTED", temporalState: "PAST" });
  assert.equal(r.label, "Отклонено");
  assert.equal(r.tone, "danger");
});

test("8 archived / archivedAt is unpublished", () => {
  assert.equal(resolve({ status: "ARCHIVED" }).label, "Снято с публикации");
  assert.equal(resolve({ status: "PUBLISHED", archivedAt: new Date() }).label, "Снято с публикации");
  assert.equal(resolve({ status: "PUBLISHED", archivedAt: new Date(), temporalState: "PAST" }).key, "unpublished");
});

test("9 cancelled wins over active and past", () => {
  assert.equal(resolve({ status: "PUBLISHED", isCancelled: true }).label, "Отменено");
  assert.equal(resolve({ status: "PUBLISHED", isCancelled: true, temporalState: "PAST" }).key, "cancelled");
});

test("10 place/offer (no temporalState) never become past", () => {
  assert.equal(resolve({ status: "PUBLISHED" }).key, "active");
  assert.equal(resolve({ status: "PUBLISHED", archivedAt: null }).key, "active");
});

test("11 boundary: session starting exactly now is not past; 1ms earlier is", () => {
  assert.equal(temporal([NOW]), "UPCOMING");
  assert.equal(temporal([new Date(NOW.getTime() - 1)]), "PAST");
  assert.equal(temporal([], NOW), "UPCOMING");
});

test("needs revision keeps its own label; promotion only when active", () => {
  assert.equal(resolve({ status: "NEEDS_REVISION" }).label, "Требует правок");
  assert.equal(isPublicationActive({ status: "PUBLISHED", temporalState: "UPCOMING" }), true);
  assert.equal(isPublicationActive({ status: "PUBLISHED", temporalState: "PAST" }), false);
  assert.equal(isPublicationActive({ status: "PUBLISHED", temporalState: "UNKNOWN" }), true);
});
