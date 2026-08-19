/**
 * Нет React test harness в репозитории (нет testing-library/jsdom) — новый
 * тестовый стек не подключаем. Вместо этого статически рендерим компонент
 * через `react-dom/server` (уже используется приложением, ничего нового не
 * добавляет) и проверяем итоговую HTML-разметку строковыми проверками.
 */
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { DiscoveryIntentTabs } from "./DiscoveryIntentTabs";
import { DISCOVERY_INTENT_CONFIG } from "@/lib/discovery/discoveryIntentConfig";

function findEnclosingTag(html: string, marker: string): "link" | "disabled" {
  const markerIdx = html.indexOf(marker);
  assert.ok(markerIdx !== -1, `marker not found in markup: ${marker}`);
  const lastAnchor = html.lastIndexOf("<a ", markerIdx);
  const lastDisabledSpan = html.lastIndexOf('<span role="link"', markerIdx);
  assert.ok(lastAnchor !== -1 || lastDisabledSpan !== -1, `no enclosing tag found for: ${marker}`);
  return lastDisabledSpan > lastAnchor ? "disabled" : "link";
}

function assertVariantMarkup(html: string, currentIntent: "classes" | null) {
  // 1. kuda остаётся ссылкой с href.
  assert.equal(findEnclosingTag(html, 'alt="Куда пойти"'), "link");
  assert.ok(html.includes('href="/minsk/events"'), "kuda must keep its href");

  // 2. classes/birthday/routes не имеют href и семантически отмечены disabled.
  for (const label of ["Занятия", "Праздник", "Маршруты"]) {
    assert.equal(findEnclosingTag(html, `alt="${label}"`), "disabled", `${label} must not be a link`);
  }
  assert.ok(!html.includes('href="/minsk/classes"'));
  assert.ok(!html.includes('href="/minsk/birthday"'));
  assert.ok(!html.includes('href="/minsk/routes"'));

  // 3. aria-disabled="true" у недоступных пунктов — ровно по одному на раздел.
  const ariaDisabledCount = html.split('aria-disabled="true"').length - 1;
  assert.equal(ariaDisabledCount, 3);

  // 4. Единый бейдж «Скоро» на каждый disabled-раздел.
  const badgeCount = html.split(">Скоро<").length - 1;
  assert.equal(badgeCount, 3);

  // Не допускать перехода по клавиатуре: disabled-элементы без активного tabIndex.
  const disabledTabIndexCount = html.split('tabindex="-1"').length - 1;
  assert.equal(disabledTabIndexCount, 3);

  if (currentIntent === "classes") {
    // Активный раздел при прямом открытии его URL остаётся визуально текущим,
    // даже будучи disabled в navigation.
    const classesIdx = html.indexOf('alt="Занятия"');
    const spanStart = html.lastIndexOf('<span role="link"', classesIdx);
    const spanTagEnd = html.indexOf(">", spanStart);
    const spanOpenTag = html.slice(spanStart, spanTagEnd);
    assert.ok(spanOpenTag.includes("text-foreground"), "active disabled item should read as current");
  }
}

for (const variant of ["airbnb", "default"] as const) {
  // 5. Конфигурация, а не slug-хардкод, определяет состояние.
  assert.equal(DISCOVERY_INTENT_CONFIG.kuda.navigationEnabled, true);
  assert.equal(DISCOVERY_INTENT_CONFIG.classes.navigationEnabled, false);
  assert.equal(DISCOVERY_INTENT_CONFIG.birthday.navigationEnabled, false);
  assert.equal(DISCOVERY_INTENT_CONFIG.routes.navigationEnabled, false);

  // 6. Оба визуальных варианта не падают при рендере.
  const html = renderToStaticMarkup(
    <DiscoveryIntentTabs city="minsk" currentIntent={null} variant={variant} />,
  );
  assertVariantMarkup(html, null);

  const htmlWithActiveDisabled = renderToStaticMarkup(
    <DiscoveryIntentTabs city="minsk" currentIntent="classes" variant={variant} />,
  );
  assertVariantMarkup(htmlWithActiveDisabled, "classes");
}

function findEnclosingTagByText(html: string, label: string): "link" | "disabled" {
  const marker = `>${label}<`;
  const markerIdx = html.indexOf(marker);
  assert.ok(markerIdx !== -1, `label not found in markup: ${label}`);
  const lastAnchor = html.lastIndexOf("<a ", markerIdx);
  const lastDisabledSpan = html.lastIndexOf('<span role="link"', markerIdx);
  assert.ok(lastAnchor !== -1 || lastDisabledSpan !== -1, `no enclosing tag found for: ${label}`);
  return lastDisabledSpan > lastAnchor ? "disabled" : "link";
}

function assertCompactMarkup(html: string, currentIntent: "classes" | null) {
  // 1. kuda остаётся ссылкой с href.
  assert.equal(findEnclosingTagByText(html, "Куда пойти"), "link");
  assert.ok(html.includes('href="/minsk/events"'), "kuda must keep its href");

  // 2. classes/birthday/routes без href, семантически disabled.
  for (const label of ["Занятия", "Праздник", "Маршруты"]) {
    assert.equal(findEnclosingTagByText(html, label), "disabled", `${label} must not be a link`);
  }
  assert.ok(!html.includes('href="/minsk/classes"'));
  assert.ok(!html.includes('href="/minsk/birthday"'));
  assert.ok(!html.includes('href="/minsk/routes"'));

  // 3-4. aria-disabled / tabindex=-1 / бейдж «Скоро» — по одному на раздел.
  assert.equal(html.split('aria-disabled="true"').length - 1, 3);
  assert.equal(html.split('tabindex="-1"').length - 1, 3);
  assert.equal(html.split(">Скоро<").length - 1, 3);

  // Compact: без ряда иконок (никаких <img> в разметке) — только текст.
  assert.ok(!html.includes("<img"), "compact density must not render icons");

  // Horizontal scroll: overflow-x-auto + скрытый scrollbar через проектный utility, без переноса строк.
  assert.ok(html.includes("overflow-x-auto"));
  assert.ok(html.includes("no-scrollbar"));
  assert.ok(html.includes("whitespace-nowrap"));

  // Left-aligned: без justify-center (первый пункт не должен обрезаться центрированием).
  assert.ok(!html.includes("justify-center"), "compact row must not center-align content");

  if (currentIntent === "classes") {
    const idx = html.indexOf(">Занятия<");
    const spanStart = html.lastIndexOf('<span role="link"', idx);
    const spanTagEnd = html.indexOf(">", spanStart);
    assert.ok(
      html.slice(spanStart, spanTagEnd).includes("text-foreground"),
      "active disabled item should read as current",
    );
  }
}

for (const currentIntent of [null, "classes"] as const) {
  const html = renderToStaticMarkup(
    <DiscoveryIntentTabs
      city="minsk"
      currentIntent={currentIntent}
      variant="airbnb"
      density="compact"
    />,
  );
  assertCompactMarkup(html, currentIntent);
}

console.log("DiscoveryIntentTabs.test.tsx: OK");
