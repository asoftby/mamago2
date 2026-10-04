import assert from "node:assert/strict";
import test from "node:test";
import { captureDraftJsonSchema, parseCaptureDraft } from "./captureDraft.schema";
import { entry } from "./captureDraft.testkit";

const valid = (over: Record<string, unknown> = {}) => ({
  intent: "CREATE",
  entries: [entry()],
  match: { candidatePlanItemId: null, changes: [] },
  ...over,
});

test("valid CREATE draft with requirements parses", () => {
  const result = parseCaptureDraft(
    JSON.stringify(
      valid({
        entries: [
          entry({
            requirements: [
              { kind: "PAY", text: "сдать 15 BYN", dueAt: "2026-10-07T00:00:00+03:00", dueHasTime: false, amount: 15, currency: "BYN", state: "stated" },
              { kind: "BRING", text: "вода", dueAt: null, dueHasTime: false, amount: null, currency: null, state: "inferred" },
            ],
          }),
        ],
      }),
    ),
  );
  assert.ok(result.ok);
});

test("UPDATE with changes, CANCEL and NONE parse", () => {
  const update = valid({
    intent: "UPDATE",
    match: {
      candidatePlanItemId: "cmitem1",
      changes: [{ field: "startsAt", from: "2026-10-09T09:30:00+03:00", to: "2026-10-09T10:30:00+03:00" }],
    },
  });
  assert.ok(parseCaptureDraft(JSON.stringify(update)).ok);
  assert.ok(parseCaptureDraft(JSON.stringify(valid({ intent: "CANCEL", match: { candidatePlanItemId: "cmitem1", changes: [] } }))).ok);
  assert.ok(parseCaptureDraft(JSON.stringify(valid({ intent: "NONE", entries: [] }))).ok);
});

test("a markdown-fenced JSON object is accepted", () => {
  const fenced = "```json\n" + JSON.stringify(valid()) + "\n```";
  assert.ok(parseCaptureDraft(fenced).ok);
});

test("non-JSON and wrong shapes are rejected with distinct codes", () => {
  assert.deepEqual(parseCaptureDraft("not json"), { ok: false, code: "INVALID_JSON" });
  assert.deepEqual(parseCaptureDraft(JSON.stringify([])), { ok: false, code: "INVALID_SCHEMA" });
  assert.deepEqual(parseCaptureDraft(JSON.stringify({ intent: "CREATE" })), { ok: false, code: "INVALID_SCHEMA" });
});

test("invalid enums are rejected", () => {
  for (const bad of [
    valid({ intent: "DELETE" }),
    valid({ entries: [entry({ entryType: "MEETING" })] }),
    valid({ entries: [entry({ title: { value: "x", state: "guessed" } })] }),
    valid({ entries: [entry({ requirements: [{ kind: "PAYMENT", text: "x", dueAt: null, dueHasTime: false, amount: null, currency: null, state: "stated" }] })] }),
    valid({ entries: [entry({ requirements: [{ kind: "PAY", text: "x", dueAt: null, dueHasTime: false, amount: null, currency: null, state: "missing" }] })] }),
  ]) {
    assert.equal(parseCaptureDraft(JSON.stringify(bad)).ok, false);
  }
});

test("invalid ISO dates are rejected, including offset-less and date-only values", () => {
  for (const value of ["tomorrow", "2026-10-09", "2026-10-09T09:30:00", "2026-13-40T09:30:00+03:00", "09.10.2026"]) {
    const bad = valid({ entries: [entry({ startsAt: { value, state: "stated", basis: null } })] });
    assert.equal(parseCaptureDraft(JSON.stringify(bad)).ok, false, value);
  }
  const badChange = valid({ match: { candidatePlanItemId: null, changes: [{ field: "startsAt", from: "x", to: null }] } });
  assert.equal(parseCaptureDraft(JSON.stringify(badChange)).ok, false);
  const good = valid({ entries: [entry({ startsAt: { value: "2026-10-09T06:30:00Z", state: "inferred", basis: "завтра" } })] });
  assert.ok(parseCaptureDraft(JSON.stringify(good)).ok);
});

test("forbidden and extra fields are rejected (reasoning, confidence, userId, familyId, anything else)", () => {
  for (const extra of [{ reasoning: "because" }, { confidence: 0.9 }, { userId: "u1" }, { familyId: "f1" }, { debug: true }]) {
    assert.equal(parseCaptureDraft(JSON.stringify({ ...valid(), ...extra })).ok, false, JSON.stringify(extra));
  }
  const nested = valid({ entries: [{ ...entry(), reasoning: "x" }] });
  assert.equal(parseCaptureDraft(JSON.stringify(nested)).ok, false);
  const nestedField = valid({ entries: [entry({ child: { childId: null, raw: null, state: "missing", userId: "u1" } })] });
  assert.equal(parseCaptureDraft(JSON.stringify(nestedField)).ok, false);
});

test("inferred basis is preserved verbatim", () => {
  const result = parseCaptureDraft(
    JSON.stringify(valid({ entries: [entry({ startsAt: { value: "2026-10-10T10:00:00+03:00", state: "inferred", basis: "«завтра» от 9 октября" } })] })),
  );
  assert.ok(result.ok);
  assert.equal(result.ok && result.draft.entries[0]!.startsAt.basis, "«завтра» от 9 октября");
});

test("JSON Schema export is strict-object shaped and contains no forbidden properties", () => {
  const schema = JSON.stringify(captureDraftJsonSchema());
  assert.ok(schema.includes('"additionalProperties":false'));
  for (const forbidden of ["reasoning", "confidence", "userId", "familyId"]) {
    assert.ok(!schema.includes(`"${forbidden}"`), forbidden);
  }
});
