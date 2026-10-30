import assert from "node:assert/strict";
import {
  BULK_REVIEW_MAX,
  checkBulkPublishEligibility,
  checkBulkRejectEligibility,
  summarizeBulkResults,
  type BulkCandidate,
  type BulkItemResult,
} from "./import-review-bulk.service";
import { skippedFlags } from "../normalizers/telegram-post.mapper";

const good = (over: Partial<BulkCandidate> = {}): BulkCandidate => ({
  entityTypeHint: "EVENT",
  publishedActivityId: null,
  publishedPlaceId: null,
  reviewStatus: "PENDING",
  normalizedData: { title: "Мастер-класс", startAt: "2026-11-08T14:00:00+03:00", venueName: "Арт-студия" },
  qualityFlags: null,
  task: { id: "t1", status: "PENDING", suggestedAction: "CREATE_NEW" },
  ...over,
});

const verdict = (c: BulkCandidate) => checkBulkPublishEligibility(c);
const reason = (c: BulkCandidate) => {
  const v = verdict(c);
  return v.ok ? "ok" : v.reason;
};

// ── Publish eligibility ──────────────────────────────────────────────────────
assert.equal(reason(good()), "ok");
assert.equal(reason(good({ task: { id: "t1", status: "IN_PROGRESS", suggestedAction: "CREATE_NEW" } })), "ok");
assert.equal(reason(good({ entityTypeHint: "PLACE" })), "not_event");
assert.equal(reason(good({ publishedActivityId: "a1" })), "already_linked");
assert.equal(reason(good({ publishedPlaceId: "p1" })), "already_linked");
assert.equal(reason(good({ reviewStatus: "APPROVED" })), "already_decided");
assert.equal(reason(good({ reviewStatus: "REJECTED" })), "already_decided");
assert.equal(reason(good({ task: null })), "no_open_task");
assert.equal(reason(good({ task: { id: "t1", status: "COMPLETED", suggestedAction: "CREATE_NEW" } })), "no_open_task");
assert.equal(reason(good({ task: { id: "t1", status: "CANCELLED", suggestedAction: "CREATE_NEW" } })), "no_open_task");
for (const action of ["UPDATE_EXISTING", "MERGE", "REJECT", null]) {
  assert.equal(reason(good({ task: { id: "t1", status: "PENDING", suggestedAction: action } })), "not_create_new", String(action));
}

// Required fields: title, a date, and a venue or an address.
assert.equal(reason(good({ normalizedData: { startAt: "2026-11-08T14:00:00+03:00", venueName: "X" } })), "incomplete");
assert.equal(reason(good({ normalizedData: { title: "  ", startAt: "2026-11-08T14:00:00+03:00", venueName: "X" } })), "incomplete");
assert.equal(reason(good({ normalizedData: { title: "T", venueName: "X" } })), "incomplete");
assert.equal(reason(good({ normalizedData: { title: "T", startAt: "2026-11-08T14:00:00+03:00" } })), "incomplete");
assert.equal(reason(good({ normalizedData: null })), "incomplete");
assert.equal(reason(good({ normalizedData: { title: "T", addressText: "ул. Ленина, 5", occurrences: [{ startAt: "2026-11-08T14:00:00+03:00" }] } })), "ok", "a session date and an address are enough");

// Telegram signals that need an editor are never published in bulk.
const tg = (over: object) => ({ ...skippedFlags("poll", "EVENT"), skipReason: null, ...over });
assert.equal(reason(good({ qualityFlags: tg({}) })), "ok");
assert.equal(reason(good({ qualityFlags: tg({ hasConflict: true }) })), "has_conflict");
assert.equal(reason(good({ qualityFlags: tg({ pendingDuplicates: [{ recordId: "r", sourceId: "s", title: "x", score: 0.8, reason: "" }] }) })), "has_duplicates");
assert.equal(reason(good({ qualityFlags: tg({ sourceChanged: { fields: ["dates"], detectedAt: "x" } }) })), "source_changed");
// Flags of other sources (ABWS) carry no Telegram signals and do not block.
assert.equal(reason(good({ qualityFlags: { multiVenue: true, belowPriceFloor: false, nonMinskCity: false } })), "ok");

// ── Reject eligibility ───────────────────────────────────────────────────────
assert.equal(checkBulkRejectEligibility(good()).ok, true);
assert.equal(checkBulkRejectEligibility(good({ entityTypeHint: "PLACE" })).ok, true, "places can be rejected too");
assert.equal(checkBulkRejectEligibility(good({ task: { id: "t", status: "PENDING", suggestedAction: "MERGE" } })).ok, true, "any recommendation can be rejected");
assert.deepEqual(checkBulkRejectEligibility(good({ publishedActivityId: "a1" })), { ok: false, reason: "already_linked" });
assert.deepEqual(checkBulkRejectEligibility(good({ reviewStatus: "APPROVED" })), { ok: false, reason: "already_decided" });
assert.deepEqual(checkBulkRejectEligibility(good({ task: null })), { ok: false, reason: "no_open_task" });

// ── Summary ──────────────────────────────────────────────────────────────────
const r = (outcome: BulkItemResult["outcome"], reason?: string): BulkItemResult => ({ importedRecordId: "x", title: null, outcome, reason });
assert.equal(summarizeBulkResults([]), "Ничего не изменено");
assert.equal(summarizeBulkResults([r("published"), r("published")]), "Опубликовано 2");
assert.equal(
  summarizeBulkResults([r("published"), r("skipped", "has_conflict"), r("skipped", "has_conflict"), r("skipped", "not_create_new"), r("failed", "boom")]),
  "Опубликовано 1, пропущено 3 (текст и афиша расходятся; не «создать новое»: нужен взгляд редактора), ошибок 1",
);
assert.equal(summarizeBulkResults([r("rejected"), r("rejected")]), "Отклонено 2");
assert.ok(BULK_REVIEW_MAX >= 10 && BULK_REVIEW_MAX <= 100);

console.log("import-review-bulk tests: OK");
