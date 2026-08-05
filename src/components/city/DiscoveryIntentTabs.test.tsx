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

console.log("DiscoveryIntentTabs.test.tsx: OK");
