import assert from "node:assert/strict";
import test from "node:test";
import type { OfferPageData } from "@/lib/offer/offerPageTypes";
import { buildCollectionOfferSections, collectionOfferTypeLabel } from "./collectionCardSections";

const base = { schedule: undefined, pricing: {}, cta: { primaryLabel: "Записаться" } } as OfferPageData;
const titles = (p: OfferPageData, type: Parameters<typeof buildCollectionOfferSections>[1]) => buildCollectionOfferSections(p, type).map((s) => s.title);

test("classes use canonical schedule and booking instructions", () => {
  const p = { ...base, schedule: { type: "classes", items: [{ id: "a", groupName: "Младшая", days: "Пн", time: "11:00" }] }, cta: { ...base.cta, instructions: "Запись обязательна" } } as OfferPageData;
  assert.deepEqual(titles(p, "REGULAR_ACTIVITY"), ["Расписание", "Условия записи"]);
  assert.match(buildCollectionOfferSections(p, "REGULAR_ACTIVITY")[0].lines[0], /11:00/);
});
test("party package includes real component names and respects optional flag", () => {
  const sections = buildCollectionOfferSections(base, "PARTY_PACKAGE", [{ title: "Аниматор", isOptional: false }, { title: "Торт", isOptional: true }]);
  assert.deepEqual(sections.map((s) => s.title), ["Что входит"]);
  assert.deepEqual(sections[0].lines, ["Аниматор", "Торт (дополнительно)"]);
});
test("camp shows shifts and accommodation from published page data", () => {
  const p = { ...base, schedule: { type: "shifts", items: [{ id: "s", dateFrom: "12 июня", price: "500 BYN" }] }, accommodation: { type: "Коттеджи", mealInfo: "Трёхразовое питание" } } as OfferPageData;
  assert.deepEqual(titles(p, "CAMP"), ["Смены", "Проживание и питание"]);
});
test("place hours only when available, empty fields don't create invented panels", () => {
  assert.deepEqual(titles(base, "PLACE_VISIT"), []);
  assert.deepEqual(titles({ ...base, openingHours: { lines: ["Пн–Пт 10–18"], closedDates: [] } }, "PLACE_VISIT"), ["Режим работы"]);
});
test("no more than three additional sections and untrusted markup becomes plain text", () => {
  const p = { ...base, schedule: { type: "classes", items: [{ id: "1", title: "<b>Группа 1</b>" }] }, perks: [{ stat: "Рисование", label: "Программа" }], cta: { primaryLabel: "Записаться", instructions: "<script>не доверять</script>" } } as OfferPageData;
  const sections = buildCollectionOfferSections(p, "ONE_TIME_ACTIVITY");
  assert.equal(sections.length, 3);
  assert.ok(!sections.flatMap((s) => s.lines).join(" ").includes("<"));
});

test("offer badge respects canonical product type, not coarse legacy category", () => {
  assert.equal(collectionOfferTypeLabel("PARTY_PACKAGE", "SINGLE"), "Праздник под ключ");
  assert.equal(collectionOfferTypeLabel("ONE_TIME_ACTIVITY", "SINGLE"), "Занятие");
  assert.equal(collectionOfferTypeLabel("PLACE_VISIT", "SINGLE"), "Посещение места");
});
