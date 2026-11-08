import assert from "node:assert/strict";
import { draftRequestSchema } from "@/server/services/dayScenarioEngine/draft.service";
import {
  AGE_ANSWERS,
  HISTORY_LIMIT,
  applyAlternative,
  buildDraftBody,
  markExhausted,
  restartVariants,
  canGoBack,
  initialPersonSelection,
  itemHref,
  datesForChoice,
  dayTabLabel,
  dayTitle,
  emptyHistory,
  entryLabel,
  freshItemOf,
  formatTime,
  itemNotes,
  legLabel,
  metaLine,
  pluralPlaces,
  popDraft,
  pushDraft,
  rangesForAnswers,
  removeItem,
  summaryLine,
  upcomingDays,
  weekendDates,
  windowFor,
  type Draft,
  type DraftItem,
} from "./model";

const item = (id: string, start: string, end: string, over: Partial<DraftItem> = {}): DraftItem => ({
  kind: "event", hoursUnconfirmed: false, scheduleUnconfirmed: false, activityId: id,
  card: { id, slug: id, title: id, coverImageUrl: null, ageLabel: null, categoryName: null, priceFrom: null, priceTo: null, priceText: null, currency: null, address: null },
  startsAt: start, endsAt: end, pinned: false, travel: null, approximatePlace: false, far: false, ...over,
});
const draft = (...ids: string[]): Draft => ({ items: ids.map((id, i) => item(id, `2026-11-14T0${7 + i}:00:00Z`, `2026-11-14T0${8 + i}:30:00Z`)), status: "ok", suggestMode: null, mode: "car" });

// ---- weekend: the weekend still ahead
assert.deepEqual(weekendDates("2026-11-07"), ["2026-11-07", "2026-11-08"], "on Saturday: today and tomorrow");
assert.deepEqual(weekendDates("2026-11-08"), ["2026-11-14", "2026-11-15"], "on Sunday: the next weekend");
assert.deepEqual(weekendDates("2026-11-09"), ["2026-11-14", "2026-11-15"], "Monday");
assert.deepEqual(weekendDates("2026-11-13"), ["2026-11-14", "2026-11-15"], "Friday");
assert.deepEqual(weekendDates("2026-12-31"), ["2027-01-02", "2027-01-03"], "across a year end");

// ---- when answers
assert.deepEqual(datesForChoice("today", "2026-11-09", null), ["2026-11-09"]);
assert.deepEqual(datesForChoice("tomorrow", "2026-11-30", null), ["2026-12-01"]);
assert.deepEqual(datesForChoice("weekend", "2026-11-09", null), ["2026-11-14", "2026-11-15"]);
assert.deepEqual(datesForChoice("other", "2026-11-09", null), [], "no day picked yet");
assert.deepEqual(datesForChoice("other", "2026-11-09", "2026-11-20"), ["2026-11-20"]);
assert.equal(upcomingDays("2026-11-09", 3).join(), "2026-11-09,2026-11-10,2026-11-11");

// ---- fixed windows from the mockup
assert.deepEqual(windowFor("2026-11-14"), { dayStart: "10:00", dayEnd: "20:00" });
assert.deepEqual(windowFor("2026-11-15"), { dayStart: "10:00", dayEnd: "20:00" });
assert.deepEqual(windowFor("2026-11-11"), { dayStart: "16:00", dayEnd: "20:00" });

// ---- labels
assert.equal(dayTitle("2026-11-14"), "Суббота, 14 ноября");
assert.equal(dayTitle("2026-03-01"), "Воскресенье, 1 марта");
assert.equal(dayTabLabel("2026-11-15"), "Вс · 15 ноября");
assert.equal(formatTime("2026-11-14T07:30:00Z"), "10:30", "times are Minsk wall-clock (UTC+3)");
assert.equal(legLabel({ mode: "car", minutes: 15, distanceM: 4000 }), "на машине · 15 мин");
assert.equal(legLabel({ mode: "walk", minutes: 9.6, distanceM: 700 }), "пешком · 10 мин");
assert.equal(legLabel({ mode: "walk", minutes: 0.2, distanceM: 10 }), "пешком · 1 мин", "never '0 мин'");
assert.equal(legLabel(null), null);
assert.deepEqual([1, 2, 5, 11, 12, 21, 24, 25].map(pluralPlaces), ["1 место", "2 места", "5 мест", "11 мест", "12 мест", "21 место", "24 места", "25 мест"]);
assert.equal(summaryLine([]), "");
assert.equal(summaryLine([item("a", "2026-11-14T07:30:00Z", "2026-11-14T09:00:00Z"), item("b", "2026-11-14T12:00:00Z", "2026-11-14T14:40:00Z")]), "2 места · с 10:30 до 17:40");
assert.deepEqual(itemNotes(item("a", "x", "y")), []);
assert.deepEqual(itemNotes(item("a", "x", "y", { hoursUnconfirmed: true, scheduleUnconfirmed: true, approximatePlace: true, far: true })), ["уточните часы работы", "время по расписанию, уточните", "примерное место", "далеко — заменить?"]);
const card = (over: Partial<DraftItem["card"]>) => ({ ...item("a", "x", "y").card, ...over });
assert.equal(metaLine(card({ categoryName: "Музей", ageLabel: "3+", priceFrom: 12, currency: "BYN" })), "Музей · 3+ · 12 BYN");
assert.equal(metaLine(card({ categoryName: "Музей", priceFrom: 12, priceTo: 20, currency: "BYN" })), "Музей · от 12 BYN");
assert.equal(metaLine(card({ categoryName: "Игровая", priceText: "бесплатно" })), "Игровая · бесплатно");
assert.equal(metaLine(card({})), "");
assert.equal(entryLabel(false), "Собрать день");
assert.equal(entryLabel(true), "Дополнить день");

// ---- age answers
assert.deepEqual(rangesForAnswers(["u3"]), ["0-1", "1-3"]);
assert.deepEqual(rangesForAnswers(["3-6", "7-10"]), ["3-5", "5-7", "7-9", "9-12"]);
assert.deepEqual(rangesForAnswers([]), []);
assert.deepEqual(rangesForAnswers(["u3", "u3"]), ["0-1", "1-3"], "no duplicates");
assert.equal(AGE_ANSWERS.length, 4);

// ---- history: another variant keeps the previous one, "Вернуть прошлый" restores it
{
  let h = emptyHistory();
  assert.equal(canGoBack(h), false);
  h = pushDraft(h, draft("a", "b"), 0);
  assert.equal(canGoBack(h), false, "the first draft has nothing before it");
  h = pushDraft(h, draft("c", "d"), 1);
  assert.deepEqual([h.current?.items.map((i) => i.activityId), h.variant, canGoBack(h)], [["c", "d"], 1, true]);
  h = popDraft(h);
  assert.deepEqual(h.current?.items.map((i) => i.activityId), ["a", "b"]);
  assert.equal(canGoBack(h), false);
  assert.equal(popDraft(h), h, "popping with nothing to restore changes nothing");
  // an empty result is not worth coming back to
  let e = pushDraft(emptyHistory(), { ...draft(), items: [], status: "empty" }, 0);
  e = pushDraft(e, draft("x"), 1);
  assert.equal(canGoBack(e), false);
  // bounded
  let many = emptyHistory();
  for (let i = 0; i < HISTORY_LIMIT + 4; i += 1) many = pushDraft(many, draft(`d${i}`), i);
  assert.equal(many.past.length, HISTORY_LIMIT);
  assert.equal(many.past[0]!.items[0]!.activityId, `d${HISTORY_LIMIT + 2}`, "newest first");
}

// ---- remove is local and undoable; removing the last point leaves an honest empty state
{
  let h = pushDraft(emptyHistory(), draft("a", "b"), 0);
  h = removeItem(h, "a");
  assert.deepEqual(h.current?.items.map((i) => i.activityId), ["b"]);
  assert.equal(canGoBack(h), true);
  assert.equal(popDraft(h).current?.items.length, 2, "undo brings the removed point back");
  assert.equal(removeItem(h, "nope"), h, "unknown id: unchanged");
  const last = removeItem(h, "b");
  assert.equal(last.current?.status, "empty");
  assert.equal(last.current?.items.length, 0);
}

// ---- removing a point must not leave a travel leg that describes a different pair
{
  const leg = (min: number) => ({ mode: "car" as const, minutes: min, distanceM: min * 400 });
  const abc: Draft = { items: [item("a", "2026-11-14T07:00:00Z", "2026-11-14T08:30:00Z"), item("b", "2026-11-14T09:00:00Z", "2026-11-14T10:30:00Z", { travel: leg(15) }), item("c", "2026-11-14T11:00:00Z", "2026-11-14T12:30:00Z", { travel: leg(20) })], status: "ok", suggestMode: null, mode: "car" };
  const travelOf = (h: ReturnType<typeof removeItem>) => h.current?.items.map((i) => [i.activityId, i.travel?.minutes ?? null]);
  const base = pushDraft(emptyHistory(), abc, 0);
  assert.deepEqual(travelOf(removeItem(base, "b")), [["a", null], ["c", null]], "A -> C is not B -> C: the leg is dropped, not shown wrong");
  assert.deepEqual(travelOf(removeItem(base, "a")), [["b", null], ["c", 20]], "the new first point has no leg; B -> C is still B -> C");
  assert.deepEqual(travelOf(removeItem(base, "c")), [["a", null], ["b", 15]], "removing the last point keeps the others' legs");
  assert.equal(popDraft(removeItem(base, "b")).current?.items[2]?.travel?.minutes, 20, "undo brings the original legs back");
}

// ---- "Другой вариант" remembers what was shown; "nothing new" is a state, not a silent repeat
{
  let h = pushDraft(emptyHistory(), draft("a", "b"), 0);
  assert.deepEqual(h.shown, ["a", "b"]);
  h = pushDraft(h, draft("b", "c"), 1);
  assert.deepEqual(h.shown, ["a", "b", "c"], "the union of every shown point, no duplicates");
  assert.equal(h.exhausted, false);
  const ex = markExhausted(h);
  assert.equal(ex.exhausted, true);
  assert.equal(ex.current, h.current, "the draft stays on screen");
  assert.equal(markExhausted(ex), ex, "marking twice is a no-op");
  assert.equal(popDraft(ex).exhausted, false, "going back is a new state");
  assert.deepEqual(popDraft(ex).shown, ["a", "b", "c"], "what was shown stays shown after going back");
  assert.equal(pushDraft(ex, draft("d"), 2).exhausted, false, "a new draft clears it");
  const again = restartVariants(ex);
  assert.deepEqual([again.exhausted, again.variant, again.shown], [false, 0, ["b", "c"]], "«Показать заново»: only the current day counts as shown");
  assert.equal(restartVariants(emptyHistory()).current, null);
  // the request carries what was shown
  const body = draftRequestSchema.parse(buildDraftBody({ city: "minsk", date: "2026-11-14", mode: "car", ageRanges: [], personaIds: [] }, "another", { variant: 2, items: draft("b", "c").items, shown: h.shown }));
  assert.deepEqual([body.action, body.shownActivityIds, body.variant], ["another", ["a", "b", "c"], 2]);
  const many = draftRequestSchema.parse(buildDraftBody({ city: "minsk", date: "2026-11-14", mode: "car", ageRanges: [], personaIds: [] }, "another", { shown: Array.from({ length: 150 }, (_, i) => `x${i}`) }));
  assert.equal(many.shownActivityIds.length, 100, "bounded to what the API accepts (newest kept)");
  assert.equal(many.shownActivityIds.at(-1), "x149");
}

// ---- alternatives
{
  const current = draft("a", "b", "c");
  const variant = [...current.items.slice(0, 1), item("z", "2026-11-14T08:00:00Z", "2026-11-14T09:00:00Z"), current.items[2]!];
  const ids = new Set(current.items.map((i) => i.activityId));
  assert.equal(freshItemOf(variant, ids, "b")?.activityId, "z");
  assert.equal(freshItemOf(current.items, ids, "b"), null, "a variant with nothing new offers nothing");
  const h = applyAlternative(pushDraft(emptyHistory(), current, 0), variant);
  assert.deepEqual(h.current?.items.map((i) => i.activityId), ["a", "z", "c"]);
  assert.equal(popDraft(h).current?.items.map((i) => i.activityId).join(), "a,b,c");
}

// ---- request bodies parse with the server schema, for guests and members
{
  const guest = buildDraftBody({ city: "minsk", date: "2026-11-14", mode: "car", ageRanges: ["3-5", "5-7"], personaIds: [] }, "build");
  const parsedGuest = draftRequestSchema.parse(guest);
  assert.deepEqual([parsedGuest.ageRanges, parsedGuest.personaIds, parsedGuest.dayStart, parsedGuest.dayEnd], [["3-5", "5-7"], [], "10:00", "20:00"]);
  const member = buildDraftBody({ city: "minsk", date: "2026-11-11", mode: "walk", ageRanges: ["3-5"], personaIds: ["p1", "p2"] }, "build");
  const parsedMember = draftRequestSchema.parse(member);
  assert.deepEqual([parsedMember.ageRanges, parsedMember.personaIds, parsedMember.dayStart, parsedMember.mode], [[], ["p1", "p2"], "16:00", "walk"], "a member sends personas only: the server resolves ages");
  const items = draft("a", "b").items;
  const rebuild = draftRequestSchema.parse(buildDraftBody({ city: "minsk", date: "2026-11-14", mode: "car", ageRanges: [], personaIds: [] }, "rebuild", { variant: 2, items }));
  assert.deepEqual([rebuild.variant, rebuild.current.length, rebuild.pinnedActivityIds.length], [2, 2, 0]);
  const more = draftRequestSchema.parse(buildDraftBody({ city: "minsk", date: "2026-11-14", mode: "car", ageRanges: [], personaIds: [] }, "rebuild", { items, pinAll: true, targetCount: items.length + 1 }));
  assert.deepEqual([more.pinnedActivityIds, more.targetCount], [["a", "b"], 3]);
  const capped = draftRequestSchema.parse(buildDraftBody({ city: "minsk", date: "2026-11-14", mode: "car", ageRanges: [], personaIds: [] }, "rebuild", { items, pinAll: true, targetCount: 9 }));
  assert.equal(capped.targetCount, 4, "the engine never gets more than 4 points");
  const otherCity = draftRequestSchema.parse(buildDraftBody({ city: "grodno", date: "2026-11-14", mode: "car", ageRanges: [], personaIds: [] }, "build"));
  assert.equal(otherCity.city, "grodno", "the page's city reaches the engine (its pool is per city)");
  assert.equal(parsedGuest.city, "minsk");
  const alt = draftRequestSchema.parse(buildDraftBody({ city: "minsk", date: "2026-11-14", mode: "car", ageRanges: [], personaIds: [] }, "alternatives", { items, replaceActivityId: "b" }));
  assert.deepEqual([alt.action, alt.replaceActivityId], ["alternatives", "b"]);
}

// ---- "С кем идём?" starts from the page's "Для кого?"; cards link to their public page
{
  const family = ["me", "taisiya", "stepan"];
  assert.deepEqual(initialPersonSelection(family, ["stepan"]), ["stepan"], "Степан chosen on the page: his chip is on");
  assert.deepEqual(initialPersonSelection(family, ["taisiya", "stepan"]), ["taisiya", "stepan"]);
  assert.deepEqual(initialPersonSelection(family, []), [], "nobody chosen: «Все»");
  assert.deepEqual(initialPersonSelection(family, family), [], "everybody chosen is «Все», not three pressed chips");
  assert.deepEqual(initialPersonSelection(family, ["ghost"]), [], "a person who is not in this family is ignored");
  assert.deepEqual(initialPersonSelection(family, ["stepan", "stepan", "ghost"]), ["stepan"], "duplicates and strangers dropped");

  const card = (slug: string | null) => ({ id: "x", slug, title: "T", coverImageUrl: null, ageLabel: null, categoryName: null, priceFrom: null, priceTo: null, priceText: null, currency: null, address: null });
  assert.equal(itemHref({ kind: "event", activityId: "ev1", card: card("kids-show") }, "minsk"), "/minsk/events/kids-show");
  assert.equal(itemHref({ kind: "place", activityId: "pl1", card: card("park-1") }, "grodno"), "/grodno/places/park-1");
  assert.equal(itemHref({ kind: "event", activityId: "ev1", card: card(null) }, "minsk"), "/minsk/events/ev1", "an event without a slug opens by id");
  assert.equal(itemHref({ kind: "place", activityId: "pl1", card: card(null) }, "minsk"), null, "a place has no id route: no link");
  assert.equal(itemHref({ kind: "event", activityId: "ev1", card: card("a/b") }, "minsk"), null, "no path tricks");
  assert.equal(itemHref({ kind: "event", activityId: "ev1", card: card("kids-show") }, undefined), null, "no city: no link");
  assert.equal(itemHref({ kind: "event", activityId: "ev1", card: card("kids-show") }, "../x"), null);
}

console.log("dayScenarioUi model tests passed");
