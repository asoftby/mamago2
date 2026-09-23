import assert from "node:assert/strict";
import { prepareEventDescriptionHtml } from "./eventDescriptionHtml";

const longPlainText =
  "Приглашаем семьи на большой городской праздник с насыщенной программой для детей. " +
  "На площадке будут мастер-классы, игры и выступления, а ведущие помогут выбрать занятия по возрасту. " +
  "Можно будет спокойно провести несколько часов всей семьёй и сделать фотографии в тематических зонах. " +
  "Организаторы подготовили отдельные зоны отдыха и активности для самых маленьких гостей. " +
  "Лучше прийти немного заранее, чтобы зарегистрироваться и ознакомиться с расписанием. " +
  "На месте будут координаторы, которые помогут с навигацией и подскажут детали программы.";

const formattedPlain = prepareEventDescriptionHtml(longPlainText);
assert.ok(
  (formattedPlain.match(/<p>/g) ?? []).length >= 2,
  "long imported plain text must render as multiple paragraphs",
);

const semanticPlain =
  "КУПИТЬ БИЛЕТЫ можно на сайте организатора. Возраст 6+. Продолжительность: 90 минут. Россия, 2026.";
const semanticHtml = prepareEventDescriptionHtml(semanticPlain);
assert.ok(
  semanticHtml.includes("КУПИТЬ БИЛЕТЫ можно на сайте организатора."),
  "render-time paragraph formatting must not remove ticket copy",
);
assert.ok(
  semanticHtml.includes("Возраст 6+."),
  "render-time paragraph formatting must not extract or rewrite age copy",
);
assert.ok(
  semanticHtml.includes("Продолжительность: 90 минут."),
  "render-time paragraph formatting must not extract or rewrite duration copy",
);
assert.ok(
  semanticHtml.includes("Россия, 2026."),
  "render-time paragraph formatting must not extract or rewrite country/year copy",
);

const richHtml =
  "<h2>Программа</h2><p><strong>Первый блок</strong></p><ul><li>Игра</li><li>Мастер-класс</li></ul>";
const formattedRich = prepareEventDescriptionHtml(richHtml);
assert.ok(formattedRich.includes("<h2>Программа</h2>"));
assert.ok(formattedRich.includes("<strong>Первый блок</strong>"));
assert.ok(formattedRich.includes("<ul><li>Игра</li><li>Мастер-класс</li></ul>"));

console.log("eventDescriptionHtml.test.ts: OK");
