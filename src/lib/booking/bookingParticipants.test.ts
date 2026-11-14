import assert from "node:assert/strict";
import {
  bookingChildrenInputSchema,
  childAgeWarning,
  childrenOutsideEventAge,
  eventAgeRuleFromActivity,
  formatParticipantsLine,
  formatParticipantsSummary,
  parseStoredChildren,
  requestedProfileChildIds,
  resolveParticipants,
  BookingParticipantsError,
} from "./bookingParticipants";
import {
  INITIAL_PARTICIPANTS_DRAFT,
  participantsDraftToPayload,
  validateParticipantsDraft,
} from "../../components/event-page/participantsDraft";

const now = new Date("2026-11-13T12:00:00Z");

// ── validation ──
assert.equal(bookingChildrenInputSchema.safeParse([{ age: 5 }]).success, true);
assert.equal(bookingChildrenInputSchema.safeParse([{ age: 5, name: "  Маша " }]).data?.[0]?.name, "Маша");
assert.equal(bookingChildrenInputSchema.safeParse([{ name: "Без возраста" }]).success, false, "age required for manual child");
assert.equal(bookingChildrenInputSchema.safeParse([{ age: 18 }]).success, false);
assert.equal(bookingChildrenInputSchema.safeParse([{ age: -1 }]).success, false);
assert.equal(bookingChildrenInputSchema.safeParse([{ age: 2.5 }]).success, false);
assert.equal(bookingChildrenInputSchema.safeParse([{ age: 5, name: "x".repeat(51) }]).success, false);
assert.equal(bookingChildrenInputSchema.safeParse([{ age: 5, secret: "x" }]).success, false, "unknown fields rejected");
assert.equal(bookingChildrenInputSchema.safeParse(Array.from({ length: 11 }, () => ({ age: 3 }))).success, false);
assert.equal(bookingChildrenInputSchema.safeParse([{ childId: "c1" }]).success, true);

// ── counts: seats = adults + children from the real composition ──
const counted = resolveParticipants({ adultsCount: 2, children: [{ age: 4 }, { age: 6, name: "Петя" }], profileChildren: [], now });
assert.equal(counted.adultsCount + counted.childrenCount, 4);
assert.deepEqual(counted.children, [{ name: null, age: 4 }, { name: "Петя", age: 6 }]);
assert.throws(() => resolveParticipants({ adultsCount: 0, children: [], profileChildren: [], now }), BookingParticipantsError);
assert.throws(() => resolveParticipants({ adultsCount: 11, children: [], profileChildren: [], now }), BookingParticipantsError);

// ── ACL: only rows the caller got under family scope can be picked ──
const owned = [{ id: "mine", name: "Лиза", birthDate: new Date("2020-05-01") }];
const ok = resolveParticipants({ adultsCount: 1, children: [{ childId: "mine", age: 99 as never, name: "подмена" }], profileChildren: owned, now });
assert.deepEqual(ok.children, [{ name: "Лиза", age: 6 }], "name/age come from DB, client values ignored");
assert.throws(
  () => resolveParticipants({ adultsCount: 1, children: [{ childId: "foreign" }], profileChildren: owned, now }),
  (e: unknown) => e instanceof BookingParticipantsError && e.field === "children",
);
assert.throws(() => resolveParticipants({ adultsCount: 1, children: [{ childId: "mine" }, { childId: "mine" }], profileChildren: owned, now }));
assert.deepEqual(requestedProfileChildIds([{ childId: "a" }, { age: 3 }, { childId: "a" }]), ["a"]);

// ── age warning ──
const rule = eventAgeRuleFromActivity({ agePolicy: "SPECIFIC", ageTags: ["6-9", "9-12"] });
assert.ok(rule && rule.kind === "RANGE" && rule.label === "6–12 лет");
assert.equal(childAgeWarning(8, rule), null);
assert.equal(childAgeWarning(4, rule), "Событие для 6–12 лет");
assert.equal(childAgeWarning(15, rule), "Событие для 6–12 лет");
assert.equal(childAgeWarning(null, rule), null, "unknown age: no warning");
assert.equal(eventAgeRuleFromActivity({ agePolicy: "UNRESTRICTED", ageTags: ["6-9"] }), null);
assert.equal(eventAgeRuleFromActivity({ agePolicy: "SPECIFIC", ageTags: [] }), null);
assert.equal(eventAgeRuleFromActivity({ agePolicy: "SPECIFIC", ageTags: ["0-1", "1-3", "3-5", "5-7", "7-9", "9-12", "12-14", "14-16", "16-18"] }), null);
const plus = eventAgeRuleFromActivity({ agePolicy: "SPECIFIC", ageTags: ["12+"] });
assert.equal(childAgeWarning(10, plus), "Событие для 12+");
const adult = eventAgeRuleFromActivity({ agePolicy: "ADULT_ONLY", ageTags: [] });
assert.ok(childAgeWarning(5, adult));
const months = eventAgeRuleFromActivity({ agePolicy: "SPECIFIC", ageTags: ["3-5"], ageMinMonths: 72, ageMaxMonths: 132 });
assert.equal(months?.label, "6–11 лет");
assert.deepEqual(childrenOutsideEventAge([{ name: "A", age: 3 }, { name: null, age: 8 }], rule), [{ name: "A", age: 3 }]);

// months-only restriction (empty ageTags) still yields a rule
const monthsOnly = eventAgeRuleFromActivity({ agePolicy: "SPECIFIC", ageTags: [], ageMinMonths: 72, ageMaxMonths: 132 });
assert.equal(monthsOnly?.label, "6–11 лет");
assert.equal(childAgeWarning(4, monthsOnly), "Событие для 6–11 лет");
assert.equal(childAgeWarning(8, monthsOnly), null);

// ── business formatting ──
assert.equal(
  formatParticipantsLine({ adultsCount: 1, childrenCount: 2, children: [{ name: "Маша", age: 5 }, { name: null, age: 7 }] }),
  "Взрослые: 1 · Дети: Маша (5), 7 лет",
);
assert.equal(formatParticipantsLine({ adultsCount: 2, childrenCount: 0, children: [] }), "Взрослые: 2");
assert.equal(formatParticipantsLine({ adultsCount: 1, childrenCount: 1, children: [] }), "Дети: 1".replace(/^/, "Взрослые: 1 · "));
assert.equal(
  formatParticipantsLine({ adultsCount: 1, childrenCount: 1, children: [], legacyChild: { name: "Оля", age: 4 } }),
  "Взрослые: 1 · Дети: Оля (4)",
);
assert.deepEqual(parseStoredChildren("garbage"), []);
assert.deepEqual(parseStoredChildren([{ name: "Я", age: 3 }]), [{ name: "Я", age: 3 }]);
assert.deepEqual(parseStoredChildren([{ name: "Я", age: 3, phone: "x" }]), [{ name: "Я", age: 3 }].map((c) => c), "extra keys stripped");

// ── client draft → payload ──
assert.deepEqual(participantsDraftToPayload(INITIAL_PARTICIPANTS_DRAFT), { adultsCount: 1, childrenCount: 0, children: [] });
const draft = { adults: 2, profileChildIds: ["p1"], manual: [{ key: "m1", age: "6", name: " Ваня " }, { key: "m2", age: "", name: "" }] };
assert.deepEqual(Object.keys(validateParticipantsDraft(draft)), ["m2"]);
assert.deepEqual(participantsDraftToPayload({ ...draft, manual: [draft.manual[0]!] }), {
  adultsCount: 2,
  childrenCount: 2,
  children: [{ childId: "p1" }, { age: 6, name: "Ваня" }],
});

assert.equal(formatParticipantsSummary({ adultsCount: 2, childrenCount: 2, children: [{ name: "Секрет", age: 7 }, { name: null, age: 4 }] }), "Взрослые: 2 · Дети: 2 (7, 4)");
assert.ok(!formatParticipantsSummary({ adultsCount: 1, childrenCount: 1, children: [{ name: "Секрет", age: 7 }] })!.includes("Секрет"), "list summary has no child names");

console.log("bookingParticipants tests passed");
