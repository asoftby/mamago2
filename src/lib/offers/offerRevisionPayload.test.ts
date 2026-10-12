import assert from "node:assert/strict";
import {
  applyCampSessionTexts,
  buildRevisionDiffRows,
  buildRevisionProposal,
  isRevisionPseudoColumn,
  mergeRevisionPayload,
  pruneRevisionPayload,
  replaceRevisionColumns,
  toRevisionJsonValue,
} from "./offerRevisionPayload";

class DbNull {}

// Предложение из отброшенных колонок: служебные и статус не переносятся, DbNull → null
{
  const proposal = buildRevisionProposal(["title", "status", "details", "galleryImages", "requestedPlacements", "missing"], {
    title: "Новое",
    status: "PENDING",
    details: new DbNull(),
    galleryImages: ["a.jpg", "b.jpg"],
    requestedPlacements: ["CLASSES"],
  });
  assert.deepEqual(proposal, {
    title: "Новое",
    details: null,
    galleryImages: ["a.jpg", "b.jpg"],
    requestedPlacements: ["CLASSES"],
  });
}

// Слияние: по колонке побеждает последнее значение, остальное сохраняется
assert.deepEqual(
  mergeRevisionPayload({ title: "Старое", description: "D" }, { title: "Свежее" }),
  { title: "Свежее", description: "D" },
);
assert.deepEqual(mergeRevisionPayload(null, { title: "T" }), { title: "T" });

// Пересчёт по новому запросу: колонки из запроса заменяются (в т.ч. исчезают при возврате живого значения),
// остальные остаются
assert.deepEqual(
  replaceRevisionColumns({ title: "A", description: "B", galleryImages: ["x"] }, ["title", "description"], { description: "B2" }),
  { galleryImages: ["x"], description: "B2" },
);
assert.deepEqual(replaceRevisionColumns(null, ["title"], {}), {});

// Сжатие: колонки, совпавшие с живым значением, выпадают; псевдоколонки остаются
assert.deepEqual(
  pruneRevisionPayload(
    { title: "Тот же", description: "Другое", requestedPlacements: ["CLASSES"] },
    { title: " Тот же ", description: "Прежнее" },
  ),
  { description: "Другое", requestedPlacements: ["CLASSES"] },
);

// Тексты смен: тексты берём из ревизии, даты/цену/места — живые
{
  const live = [
    { id: "s1", title: "Июнь", description: "Старое", dateFrom: "2026-06-03", priceOverride: "550", capacity: 20 },
    { id: "s2", title: "Июль", dateFrom: "2026-07-01", priceOverride: "600" },
  ];
  const proposed = [
    { id: "s1", title: "Июнь (обновлено)", description: "Новое", dateFrom: "2026-06-01", priceOverride: "500" },
  ];
  const result = applyCampSessionTexts(live, proposed);
  assert.deepEqual(result[0], {
    id: "s1",
    title: "Июнь (обновлено)",
    description: "Новое",
    dateFrom: "2026-06-03",
    priceOverride: "550",
    capacity: 20,
  });
  assert.deepEqual(result[1], live[1]);
  // смены, которых нет в живых, не добавляются; число смен не меняется
  assert.equal(applyCampSessionTexts(live, [...proposed, { id: "s9", title: "Лишняя" }]).length, 2);
  // без id — по позиции
  assert.equal(applyCampSessionTexts([{ title: "A", priceOverride: "1" }], [{ title: "B", priceOverride: "9" }])[0].title, "B");
  assert.equal(applyCampSessionTexts([{ title: "A", priceOverride: "1" }], [{ title: "B", priceOverride: "9" }])[0].priceOverride, "1");
}

// Строки диффа: подписи для человека, «было» из живого/экстра
{
  const rows = buildRevisionDiffRows(
    { title: "Новое", requestedPlacements: ["CLASSES"], somethingNew: "x" },
    { title: "Старое", somethingNew: null },
    { requestedPlacements: ["WHERE_TO_GO"] },
  );
  assert.deepEqual(rows.map((r) => [r.column, r.label, r.before, r.after]), [
    ["title", "название", "Старое", "Новое"],
    ["requestedPlacements", "разделы каталога", ["WHERE_TO_GO"], ["CLASSES"]],
    ["somethingNew", "другие данные карточки", null, "x"],
  ]);
}

assert.equal(isRevisionPseudoColumn("categoryIds"), true);
assert.equal(isRevisionPseudoColumn("title"), false);
assert.equal(toRevisionJsonValue(undefined), null);
assert.deepEqual(toRevisionJsonValue({ a: [1, 2] }), { a: [1, 2] });

console.log("offerRevisionPayload tests passed");
