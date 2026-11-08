import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ScenarioTimeline, mergeTimeline } from "./ScenarioTimeline";
import { ScenarioParams } from "./ScenarioParams";
import { ReplaceOptionsList } from "./ScenarioReplaceSheet";
import { AllShown, DraftError, DraftSkeleton, EmptyResult, FewNearbyBanner } from "./ScenarioStates";
import { useDayScenarioEnabled } from "../../hooks/useDayScenarioEnabled";
import { KudaDayScenarioEntry } from "@/components/discovery/KudaDayScenarioEntry";
import type { DraftItem } from "../../lib/dayScenarioUi/model";
import { landingFromOpenEvent } from "@/lib/my-plan/myPlanOpenIntent";
import { planOverlayReducer, type PlanOverlayAction, type PlanOverlayState } from "@/lib/my-plan/usePlanOverlay";

const item = (id: string, title: string, start: string, end: string, over: Partial<DraftItem> = {}): DraftItem => ({
  kind: "event", hoursUnconfirmed: false, scheduleUnconfirmed: false, activityId: id,
  card: { id, slug: id, title, coverImageUrl: null, ageLabel: "3+", categoryName: "Музей", priceFrom: 12, priceTo: null, priceText: null, currency: "BYN", address: null },
  startsAt: start, endsAt: end, pinned: false, travel: null, approximatePlace: false, far: false, ...over,
});
const museum = item("m", "Интерактивный музей", "2026-11-14T07:30:00Z", "2026-11-14T09:00:00Z");
const puppets = item("p", "Кукольный спектакль", "2026-11-14T11:00:00Z", "2026-11-14T12:10:00Z", {
  travel: { mode: "car", minutes: 15, distanceM: 6000 }, hoursUnconfirmed: true, approximatePlace: true,
});
const play = item("g", "Игровая комната", "2026-11-14T12:40:00Z", "2026-11-14T14:10:00Z", {
  travel: { mode: "walk", minutes: 9, distanceM: 700 }, scheduleUnconfirmed: true, far: true,
});

// ---- timeline: time, title, meta, legs, notes, own entries
{
  const html = renderToStaticMarkup(<ScenarioTimeline items={[museum, puppets, play]} busy={false} onRemove={() => {}} onReplace={() => {}} />);
  assert.ok(html.includes("10:30") && html.includes("14:00") && html.includes("15:40"), "start times in Minsk time");
  assert.ok(html.includes("Интерактивный музей") && html.includes("Музей · 3+ · 12 BYN"));
  assert.ok(html.includes("на машине · 15 мин") && html.includes("пешком · 9 мин"), "a travel leg above the point it leads to");
  assert.equal((html.match(/на машине · 15 мин/g) ?? []).length, 1, "a leg is printed once");
  assert.ok(html.includes("уточните часы работы") && html.includes("примерное место"));
  assert.ok(html.includes("время по расписанию, уточните") && html.includes("далеко — заменить?"));
  assert.equal((html.match(/>Заменить</g) ?? []).length, 3, "«Заменить» on every point");
  assert.ok(html.includes('aria-label="Убрать «Интерактивный музей»"'), "remove is labelled per point");
  assert.ok(html.includes('aria-label="План дня"'));
  assert.ok(!html.includes("disabled=\"\""), "nothing is disabled while idle");
  const busy = renderToStaticMarkup(<ScenarioTimeline items={[museum]} busy onRemove={() => {}} onReplace={() => {}} />);
  assert.ok(busy.includes("disabled"), "actions are locked while the engine is working");
}
{
  const own = [{ startsAt: "2026-11-14T15:30:00Z", title: "Бассейн" }, { startsAt: null, title: "Без времени" }];
  const rows = mergeTimeline([museum, play], own);
  assert.deepEqual(rows.map((r) => (r.kind === "stop" ? r.item.activityId : r.entry.title)), ["m", "g", "Бассейн"], "own timed entry sits in time order; an untimed one is left out");
  const html = renderToStaticMarkup(<ScenarioTimeline items={[museum, play]} ownEntries={own} busy={false} onRemove={() => {}} onReplace={() => {}} />);
  assert.ok(html.includes("Бассейн") && html.includes("уже в плане") && !html.includes("Без времени"));
}

// ---- a card opens its public page (new tab, the draft stays); without a city it is not a link
{
  const linked = renderToStaticMarkup(<ScenarioTimeline items={[museum]} city="minsk" busy={false} onRemove={() => {}} onReplace={() => {}} />);
  assert.ok(linked.includes('href="/minsk/events/m"') && linked.includes('target="_blank"') && linked.includes('rel="noopener"'));
  assert.ok(linked.includes(">Подробнее<") && linked.includes("откроется в новой вкладке"));
  const plain = renderToStaticMarkup(<ScenarioTimeline items={[museum]} busy={false} onRemove={() => {}} onReplace={() => {}} />);
  assert.ok(!plain.includes("Подробнее"), "no city: no link");
}
{
  const sheet = renderToStaticMarkup(<ReplaceOptionsList city="minsk" options={[{ fresh: puppets, items: [puppets] }]} onPick={() => {}} />);
  assert.ok(sheet.includes("Кукольный спектакль"));
  assert.ok(sheet.includes('href="/minsk/events/p"') && sheet.includes(">Подробнее<"), "an option can be looked at before it is chosen");
  assert.ok(sheet.includes('aria-label="Выбрать «Кукольный спектакль»"'), "choosing is a separate button next to the link");
}

// ---- guest params: two questions, pressed state, a day picker only for «Другой день»
{
  const base = { onWhen: () => {}, otherIso: null, onOtherIso: () => {}, todayIso: "2026-11-08", onToggleAge: () => {} };
  const html = renderToStaticMarkup(<ScenarioParams {...base} when="weekend" ageKeys={["3-6", "7-10"]} />);
  for (const label of ["Когда?", "Сегодня", "Завтра", "Выходные", "Другой день", "Сколько лет детям?", "до 3", "3–6", "7–10", "11+", "Можно выбрать несколько"]) assert.ok(html.includes(label), label);
  assert.equal((html.match(/aria-pressed="true"/g) ?? []).length, 3, "weekend + two ages pressed");
  assert.equal((html.match(/aria-pressed=/g) ?? []).length, 8, "4 when + 4 age tiles");
  assert.ok(!html.includes("data-iso"), "no day picker unless «Другой день»");
  const other = renderToStaticMarkup(<ScenarioParams {...base} when="other" ageKeys={[]} />);
  assert.ok(other.includes("data-iso"), "«Другой день» shows the day picker");
}

// ---- states
{
  assert.ok(renderToStaticMarkup(<FewNearbyBanner onSwitchToCar={() => {}} />).includes("Рядом мало вариантов"));
  assert.ok(renderToStaticMarkup(<FewNearbyBanner onSwitchToCar={() => {}} />).includes("На машине"));
  const walking = renderToStaticMarkup(<EmptyResult walking onSwitchToCar={() => {}} onChangeParams={() => {}} changeLabel="Изменить параметры" />);
  assert.ok(walking.includes("На этот день ничего не нашли") && walking.includes("Подобрать на машине") && walking.includes("Изменить параметры"));
  const driving = renderToStaticMarkup(<EmptyResult walking={false} onSwitchToCar={() => {}} onChangeParams={() => {}} changeLabel="Назад в план" />);
  assert.ok(!driving.includes("Подобрать на машине") && driving.includes("Назад в план"), "no car hint when already driving");
  assert.ok(renderToStaticMarkup(<DraftError kind="failed" onRetry={() => {}} />).includes("Повторить"));
  assert.ok(renderToStaticMarkup(<DraftError kind="rate_limited" onRetry={() => {}} />).includes("Подождите минуту"));
  assert.ok(!renderToStaticMarkup(<DraftError kind="unavailable" onRetry={() => {}} />).includes("Повторить"), "nothing to retry when the feature is off");
  assert.ok(renderToStaticMarkup(<DraftSkeleton />).includes('aria-busy="true"'));
  const allShown = renderToStaticMarkup(<AllShown onRestart={() => {}} />);
  assert.ok(allShown.includes("Мы показали всё, что подходит") && allShown.includes("Показать заново"), "the explicit «nothing new» state");
}

// ---- flag off (and until answered): the entries draw nothing
{
  function Probe() {
    return <span>{useDayScenarioEnabled() ? "on" : "off"}</span>;
  }
  assert.equal(renderToStaticMarkup(<Probe />), "<span>off</span>", "off until the config answers");
  assert.equal(renderToStaticMarkup(<KudaDayScenarioEntry />), "", "«Куда пойти» entry is absent with the flag off");
}

// ---- open My Plan on the day scenario: the overlay state carries the landing screen
{
  let state: PlanOverlayState = { isOpen: false, landing: null };
  const step = (action: PlanOverlayAction) => (state = planOverlayReducer(state, action));
  assert.deepEqual(step({ type: "open" }), { isOpen: true, landing: null }, "a plain open lands on the plan");
  assert.deepEqual(step({ type: "close" }), { isOpen: false, landing: null });
  assert.deepEqual(step({ type: "open", landing: "dayScenario" }), { isOpen: true, landing: "dayScenario" });
  assert.equal(step({ type: "clearLanding" }).landing, null, "leaving the screen clears it");
  assert.equal(state.isOpen, true, "...but the plan stays open");
  step({ type: "open", landing: "dayScenario" });
  assert.deepEqual(step({ type: "close" }), { isOpen: false, landing: null }, "closing forgets the landing: it never hijacks a later open");
  assert.deepEqual(step({ type: "toggle" }), { isOpen: true, landing: null });
  const idle: PlanOverlayState = { isOpen: true, landing: null };
  assert.equal(planOverlayReducer(idle, { type: "clearLanding" }), idle, "nothing to clear: same state object, no re-render");

  assert.equal(landingFromOpenEvent(new CustomEvent("x", { detail: { landing: "dayScenario" } })), "dayScenario");
  assert.equal(landingFromOpenEvent(new CustomEvent("x", { detail: { landing: "other" } })), null, "unknown screens are ignored");
  assert.equal(landingFromOpenEvent(new Event("x")), null, "a plain open event has no landing");
}

// ---- contracts: with the flag off the old screens are untouched
{
  const main = readFileSync("src/features/my-plan/components/PlanMainContent.tsx", "utf8");
  assert.match(main, /if \(dayScenarioEnabled\) \{\s*openNestedScreen\("dayScenario"\);\s*return;\s*\}\s*openNestedScreen\("picks"\);/, "flag off: the button opens the old picks screen");
  assert.match(main, /dayScenarioEnabled \? entryLabel\(dayItems\.length > 0\) : "Подобрать, куда сходить"/, "flag off: the old button label");
  assert.match(main, /<PlanPicksScreen/, "the old picks screen is still rendered");
  const panel = readFileSync("src/features/my-plan/components/MyPlanPanelContent.tsx", "utf8");
  assert.match(panel, /if \(!isAuthenticated && dayScenarioEnabled\)/, "guests get the new screen only with the flag on");
  assert.match(panel, /<GuestMyPlanPanel/, "the guest panel is still rendered");
  const shell = readFileSync("src/components/city/CityDiscoveryShell.tsx", "utf8");
  assert.match(shell, /intent === "kuda" \? <KudaDayScenarioEntry \/> : null/);
  const screen = readFileSync("src/features/my-plan/components/dayScenario/DayScenarioScreen.tsx", "utf8");
  assert.match(screen, /<button type="button" disabled aria-describedby="scenario-save-hint"/, "saving the day is inactive until PR 3");
  assert.match(screen, /\{current \? \(\s*<div aria-busy/, "the action row is shown for any draft, also an emptied one (undo stays reachable)");
  assert.match(screen, /api\.goBack\(activeDate\)/);
  assert.match(screen, /disabled=\{loading \|\| exhausted\}[^>]*onClick=\{\(\) => activeDate && api\.another\(activeDate\)\}/, "«Другой вариант» is off while nothing new is left");
  assert.match(screen, /exhausted \? <AllShown/, "the «Мы показали всё» state is shown");
  assert.match(main, /<DayScenarioScreen[\s\S]*?city=\{city\}/, "the member screen gets the page's city");
  assert.match(main, /<DayScenarioScreen[\s\S]*?initialPersonaIds=\{selectedPersonaIds\}/, "«С кем идём?» starts from the page's «Для кого?»");
  assert.match(panel, /<DayScenarioScreen audience="guest" city=\{city\}/, "the guest screen gets the page's city");
}

console.log("dayScenario UI tests passed");
