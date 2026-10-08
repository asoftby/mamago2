import assert from "node:assert/strict";
import {
  detectPlanItemCategory,
  isPlanItemCategoryKey,
  resolvePlanItemCategory,
  type PlanItemCategoryKey,
} from "./planItemCategory";

const cases: Array<[PlanItemCategoryKey, string[]]> = [
  ["health", ["Записаться к стоматологу", "Педиатр в 10:00", "Сдать анализы", "Прививка Тае", "ЛОР"]],
  ["sport", ["Тренировка по футболу", "Бассейн", "Гимнастика у Маши", "Каток с классом"]],
  ["school", ["Родительское собрание", "Сделать домашку", "Принести картон", "Физкультура: форма"]],
  ["clubs", ["Кружок рисования", "Шахматы в студии", "Английский с репетитором"]],
  ["shopping", ["Купить куртку", "Заказ на Ozon", "Магазин: молоко и хлеб"]],
  ["home", ["Уборка", "Вызвать сантехника", "Приготовить ужин"]],
  ["party", ["День рождения Маши", "Утренник в садике", "Подарок бабушке"]],
  ["trip", ["Поездка на дачу", "Билеты на поезд", "Отпуск"]],
];

for (const [key, titles] of cases) {
  for (const title of titles) {
    assert.equal(detectPlanItemCategory(title), key, `${title} → ${key}`);
  }
}

// «домашка» — школа, а не «дом»; «бегемот» — не спорт.
assert.equal(detectPlanItemCategory("домашка по математике"), "school");
assert.equal(detectPlanItemCategory("Сходить к бегемоту"), "note");

// Регистр и «ё».
assert.equal(detectPlanItemCategory("ВРАЧ"), "health");
assert.equal(detectPlanItemCategory("Ёлка во дворе"), "party");

// Ничего не совпало → заметка.
assert.equal(detectPlanItemCategory("Позвонить Ивану"), "note");
assert.equal(detectPlanItemCategory(""), "note");
assert.equal(detectPlanItemCategory(null), "note");

// Сохранённая категория (ручной выбор) не перезаписывается автоопределением.
assert.equal(resolvePlanItemCategory("home", "Записаться к врачу"), "home");
assert.equal(resolvePlanItemCategory(null, "Записаться к врачу"), "health");
assert.equal(resolvePlanItemCategory("garbage", "Бассейн"), "sport");
assert.equal(isPlanItemCategoryKey("trip"), true);
assert.equal(isPlanItemCategoryKey("other"), false);

console.log("planItemCategory.test ok");
