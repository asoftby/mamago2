import assert from "node:assert/strict";
import test from "node:test";
import { applyPostLlmRules, detectEscalationReason, hasExplicitDateSignal, type RuleContext } from "./captureRules";
import { draft, entry } from "./captureDraft.testkit";

const none: RuleContext = { children: [], planCandidates: [], placeShortlist: [] };
const taya = { id: "child-taya", name: "Тая", age: 7 };
const styopa = { id: "child-styopa", name: "Стёпа", age: 5 };

test("EVENT without a start but with a deadline becomes TASK (and keeps the deadline)", () => {
  const input = draft({
    entries: [
      entry({
        startsAt: { value: null, state: "missing", basis: null },
        dueAt: { value: "2026-10-07T00:00:00+03:00", hasTime: false, state: "stated" },
      }),
    ],
  });
  const result = applyPostLlmRules(input, none);
  assert.equal(result.draft.entries[0]!.entryType, "TASK");
  assert.equal(result.draft.entries[0]!.dueAt.value, "2026-10-07T00:00:00+03:00");
  assert.deepEqual(result.ruleCodes, ["EVENT_TO_TASK"]);
});

test("EVENT with neither start nor deadline stays an EVENT with no invented date", () => {
  const input = draft({ entries: [entry({ startsAt: { value: null, state: "missing", basis: null } })] });
  const result = applyPostLlmRules(input, none);
  assert.equal(result.draft.entries[0]!.entryType, "EVENT");
  assert.equal(result.draft.entries[0]!.startsAt.value, null);
  assert.deepEqual(result.ruleCodes, []);
});

test("a missing field never keeps a value, and a valueless stated field becomes missing", () => {
  const input = draft({
    entries: [
      entry({
        startsAt: { value: "2026-10-09T09:30:00+03:00", state: "missing", basis: null },
        endsAt: { value: null, state: "stated" },
      }),
    ],
  });
  const result = applyPostLlmRules(input, none);
  assert.equal(result.draft.entries[0]!.startsAt.value, null);
  assert.equal(result.draft.entries[0]!.endsAt.state, "missing");
});

test("child: 0 children leaves null, 1 child is inferred, 2+ children asks", () => {
  const input = draft();
  const zero = applyPostLlmRules(input, none);
  assert.equal(zero.draft.entries[0]!.child.childId, null);
  assert.deepEqual(zero.ruleCodes, []);

  const one = applyPostLlmRules(input, { ...none, children: [taya] });
  assert.equal(one.draft.entries[0]!.child.childId, "child-taya");
  assert.equal(one.draft.entries[0]!.child.state, "inferred");
  assert.deepEqual(one.ruleCodes, ["CHILD_INFERRED"]);

  const many = applyPostLlmRules(input, { ...none, children: [taya, styopa] });
  assert.equal(many.draft.entries[0]!.child.childId, null);
  assert.equal(many.draft.entries[0]!.child.state, "missing");
  assert.deepEqual(many.ruleCodes, ["CHILD_ASKED"]);
});

test("a stated child that belongs to the owner is kept; a foreign child id is rejected", () => {
  const stated = draft({ entries: [entry({ child: { childId: "child-styopa", raw: "Стёпа", state: "stated" } })] });
  const kept = applyPostLlmRules(stated, { ...none, children: [taya, styopa] });
  assert.equal(kept.draft.entries[0]!.child.childId, "child-styopa");
  assert.deepEqual(kept.ruleCodes, []);

  const foreign = draft({ entries: [entry({ child: { childId: "someone-elses-child", raw: null, state: "stated" } })] });
  const rejected = applyPostLlmRules(foreign, { ...none, children: [taya, styopa] });
  assert.equal(rejected.draft.entries[0]!.child.childId, null);
  assert.deepEqual(rejected.ruleCodes, ["CHILD_ID_REJECTED", "CHILD_ASKED"]);
});

test("a named child that cannot be mapped with 2+ children asks instead of guessing", () => {
  const input = draft({ entries: [entry({ child: { childId: null, raw: "Маша", state: "stated" } })] });
  const result = applyPostLlmRules(input, { ...none, children: [taya, styopa] });
  assert.equal(result.draft.entries[0]!.child.childId, null);
  assert.deepEqual(result.ruleCodes, ["CHILD_ASKED"]);
});

const museum = { id: "place-museum", title: "Музей истории", address: "ул. Мира, 1", exact: true };
const museum2 = { id: "place-museum-2", title: "Музей истории театра", address: "ул. Победы, 2", exact: false };

test("place: a shortlisted placeId is kept and marked inferred", () => {
  const input = draft({ entries: [entry({ location: { value: "Музей истории", placeId: "place-museum", state: "stated" } })] });
  const result = applyPostLlmRules(input, { ...none, placeShortlist: [museum, museum2] });
  assert.equal(result.draft.entries[0]!.location.placeId, "place-museum");
  assert.equal(result.draft.entries[0]!.location.state, "inferred");
  assert.equal(result.draft.entries[0]!.location.value, "Музей истории", "the extracted text stays in the draft");
  assert.deepEqual(result.ruleCodes, []);
});

test("place: a hallucinated placeId is rejected and the text stays", () => {
  const input = draft({ entries: [entry({ location: { value: "Музей истории", placeId: "made-up", state: "stated" } })] });
  const result = applyPostLlmRules(input, { ...none, placeShortlist: [museum2] });
  assert.equal(result.draft.entries[0]!.location.placeId, null);
  assert.equal(result.draft.entries[0]!.location.value, "Музей истории");
  assert.equal(result.draft.entries[0]!.location.state, "stated");
  assert.deepEqual(result.ruleCodes, ["PLACE_ID_REJECTED"]);
});

test("place: with an empty shortlist any placeId is rejected", () => {
  const input = draft({ entries: [entry({ location: { value: "школа", placeId: "place-museum", state: "stated" } })] });
  const result = applyPostLlmRules(input, none);
  assert.equal(result.draft.entries[0]!.location.placeId, null);
  assert.deepEqual(result.ruleCodes, ["PLACE_ID_REJECTED"]);
});

test("place: a single exact match of THIS entry's location is substituted when the model gave none (single entry)", () => {
  const input = draft({ entries: [entry({ location: { value: "Музей истории", placeId: null, state: "stated" } })] });
  const single = applyPostLlmRules(input, { ...none, placeShortlist: [museum, museum2] });
  assert.equal(single.draft.entries[0]!.location.placeId, "place-museum");
  assert.equal(single.draft.entries[0]!.location.state, "inferred");
  assert.deepEqual(single.ruleCodes, ["PLACE_AUTO_EXACT"]);

  const noLocation = draft({ entries: [entry()] });
  const untouched = applyPostLlmRules(noLocation, { ...none, placeShortlist: [museum] });
  assert.equal(untouched.draft.entries[0]!.location.placeId, null);
});

test("place: two places with the same normalized title are ambiguous and stay unresolved", () => {
  const input = draft({ entries: [entry({ location: { value: "Музей истории", placeId: null, state: "stated" } })] });
  const twin = { ...museum, id: "place-museum-twin" };
  const result = applyPostLlmRules(input, { ...none, placeShortlist: [museum, twin] });
  assert.equal(result.draft.entries[0]!.location.placeId, null);
  assert.deepEqual(result.ruleCodes, []);
});

test("place: with two events, the exact place is given only to the event whose location matches it", () => {
  const input = draft({
    entries: [
      entry({ title: { value: "Экскурсия", state: "stated" }, location: { value: "Музей истории", placeId: null, state: "stated" } }),
      entry({ title: { value: "Собрание", state: "stated" }, location: { value: "школа №5", placeId: null, state: "stated" } }),
    ],
  });
  const result = applyPostLlmRules(input, { ...none, placeShortlist: [museum] });
  assert.equal(result.draft.entries[0]!.location.placeId, "place-museum");
  assert.equal(result.draft.entries[1]!.location.placeId, null, "the school must not inherit the museum");
  assert.equal(result.draft.entries[1]!.location.state, "stated");
  assert.deepEqual(result.ruleCodes, ["PLACE_AUTO_EXACT"]);
});

test("place: two events in the same museum both get its placeId", () => {
  const input = draft({
    entries: [
      entry({ title: { value: "Экскурсия", state: "stated" }, location: { value: "Музей истории", placeId: null, state: "stated" } }),
      entry({ title: { value: "Лекция", state: "stated" }, location: { value: "музей истории!", placeId: null, state: "stated" } }),
    ],
  });
  const result = applyPostLlmRules(input, { ...none, placeShortlist: [museum] });
  assert.deepEqual(result.draft.entries.map((e) => e.location.placeId), ["place-museum", "place-museum"]);
  assert.deepEqual(result.ruleCodes, ["PLACE_AUTO_EXACT"]);
});

test("place: a location that only partially overlaps the title is not auto-substituted", () => {
  const input = draft({ entries: [entry({ location: { value: "Музей", placeId: null, state: "stated" } })] });
  const result = applyPostLlmRules(input, { ...none, placeShortlist: [museum] });
  assert.equal(result.draft.entries[0]!.location.placeId, null);
});

test("match: only backend candidates are accepted; hallucinated ids are dropped", () => {
  const candidates = { ...none, planCandidates: [{ id: "item-1", title: "Экскурсия", childId: null, startsAt: new Date() }] };
  const ok = applyPostLlmRules(
    draft({ intent: "UPDATE", match: { candidatePlanItemId: "item-1", changes: [{ field: "startsAt", from: null, to: "2026-10-09T10:30:00+03:00" }] } }),
    candidates,
  );
  assert.equal(ok.matchedPlanItemId, "item-1");
  assert.deepEqual(ok.ruleCodes, []);
  assert.equal(ok.draft.match.changes.length, 1);

  const bad = applyPostLlmRules(
    draft({ intent: "CANCEL", match: { candidatePlanItemId: "arbitrary-plan-item", changes: [] } }),
    candidates,
  );
  assert.equal(bad.matchedPlanItemId, null);
  assert.equal(bad.draft.match.candidatePlanItemId, null);
  assert.deepEqual(bad.ruleCodes, ["MATCH_ID_REJECTED", "MATCH_NO_CANDIDATE"]);
});

test("UPDATE/CANCEL without any match gets MATCH_NO_CANDIDATE; CREATE never keeps a match", () => {
  const none1 = applyPostLlmRules(draft({ intent: "UPDATE" }), none);
  assert.deepEqual(none1.ruleCodes, ["MATCH_NO_CANDIDATE"]);
  assert.equal(none1.draft.intent, "UPDATE", "the intent is not rewritten; PR4 decides the card");

  const create = applyPostLlmRules(
    draft({ intent: "CREATE", match: { candidatePlanItemId: "item-1", changes: [] } }),
    { ...none, planCandidates: [{ id: "item-1", title: null, childId: null, startsAt: null }] },
  );
  assert.equal(create.matchedPlanItemId, null);
  assert.equal(create.draft.match.candidatePlanItemId, null);
});

test("the input draft is not mutated", () => {
  const input = draft({ entries: [entry({ startsAt: { value: null, state: "missing", basis: null }, dueAt: { value: "2026-10-07T00:00:00+03:00", hasTime: false, state: "stated" } })] });
  const snapshot = JSON.stringify(input);
  applyPostLlmRules(input, none);
  assert.equal(JSON.stringify(input), snapshot);
});

test("explicit date signals: numeric and month-name dates, but not bare times or relative words", () => {
  for (const text of ["Экскурсия 9 октября в музей", "сдать до 07.10", "поездка 12/10/2026", "дата 2026-10-09", "12 янв", "1 сентября"]) {
    assert.equal(hasExplicitDateSignal(text), true, text);
  }
  for (const text of ["", "завтра в 10:00", "приносите воду", "в 9:30 у входа", "цена 15 рублей"]) {
    assert.equal(hasExplicitDateSignal(text), false, text);
  }
});

test("escalation: EVENT without a date while the source has an explicit date", () => {
  const noDate = applyPostLlmRules(draft({ entries: [entry({ startsAt: { value: null, state: "missing", basis: null } })] }), none);
  assert.equal(detectEscalationReason(noDate, none, "Экскурсия 9 октября"), "ESCALATE_EVENT_DATE");
  assert.equal(detectEscalationReason(noDate, none, "Экскурсия когда-нибудь"), null);
  const withDate = applyPostLlmRules(draft(), none);
  assert.equal(detectEscalationReason(withDate, none, "Экскурсия 9 октября"), null);
});

test("escalation: UPDATE/CANCEL without a match while candidates exist", () => {
  const ctx: RuleContext = { ...none, planCandidates: [{ id: "item-1", title: "x", childId: null, startsAt: null }] };
  const result = applyPostLlmRules(draft({ intent: "UPDATE" }), ctx);
  assert.equal(detectEscalationReason(result, ctx, "перенесли"), "ESCALATE_MATCH");
  const noCandidates = applyPostLlmRules(draft({ intent: "UPDATE" }), none);
  assert.equal(detectEscalationReason(noCandidates, none, "перенесли"), null);
  const matched = applyPostLlmRules(draft({ intent: "UPDATE", match: { candidatePlanItemId: "item-1", changes: [] } }), ctx);
  assert.equal(detectEscalationReason(matched, ctx, "перенесли"), null);
});
