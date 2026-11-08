import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ScenarioTimeline, mergeTimeline } from "./ScenarioTimeline";
import { ScenarioParams } from "./ScenarioParams";
import { ReplaceOptionsList, ScenarioReplaceScreen } from "./ScenarioReplaceScreen";
import { ScenarioItemPreview } from "./ScenarioItemPreview";
import { SavedDayBanner } from "./SavedDayBanner";
import { AllShown, DraftError, DraftSkeleton, EmptyResult, FewNearbyBanner } from "./ScenarioStates";
import { useDayScenarioEnabled } from "../../hooks/useDayScenarioEnabled";
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
  const html = renderToStaticMarkup(<ScenarioTimeline items={[museum, puppets, play]} busy={false} onOpen={() => {}} onRemove={() => {}} onReplace={() => {}} />);
  assert.ok(html.includes("10:30") && html.includes("14:00") && html.includes("15:40"), "start times in Minsk time");
  assert.ok(html.includes("Интерактивный музей") && html.includes("Музей · 3+ · 12 BYN"));
  assert.ok(html.includes("на машине · 15 мин") && html.includes("пешком · 9 мин"), "a travel leg above the point it leads to");
  assert.equal((html.match(/на машине · 15 мин/g) ?? []).length, 1, "a leg is printed once");
  assert.ok(html.includes("уточните часы работы") && html.includes("примерное место"));
  assert.ok(html.includes("время по расписанию — уточните у организатора") && html.includes("далеко — заменить?"));
  assert.equal((html.match(/>Заменить</g) ?? []).length, 3, "«Заменить» on every point");
  assert.ok(html.includes('aria-label="Убрать «Интерактивный музей»"'), "remove is labelled per point");
  assert.ok(html.includes('aria-label="План дня"'));
  assert.ok(!html.includes("disabled=\"\""), "nothing is disabled while idle");
  const busy = renderToStaticMarkup(<ScenarioTimeline items={[museum]} busy onOpen={() => {}} onRemove={() => {}} onReplace={() => {}} />);
  assert.ok(busy.includes("disabled"), "actions are locked while the engine is working");
}
{
  const own = [{ startsAt: "2026-11-14T15:30:00Z", title: "Бассейн" }, { startsAt: null, title: "Без времени" }];
  const rows = mergeTimeline([museum, play], own);
  assert.deepEqual(rows.map((r) => (r.kind === "stop" ? r.item.activityId : r.entry.title)), ["m", "g", "Бассейн"], "own timed entry sits in time order; an untimed one is left out");
  const html = renderToStaticMarkup(<ScenarioTimeline items={[museum, play]} ownEntries={own} busy={false} onOpen={() => {}} onRemove={() => {}} onReplace={() => {}} />);
  assert.ok(html.includes("Бассейн") && html.includes("уже в плане") && !html.includes("Без времени"));
}

// ---- a card opens its preview screen inside the widget (no new tab, the draft stays); the public page lives on that screen
{
  const html = renderToStaticMarkup(<ScenarioTimeline items={[museum]} busy={false} onOpen={() => {}} onRemove={() => {}} onReplace={() => {}} />);
  assert.ok(html.includes('aria-label="Подробнее о «Интерактивный музей»"') && html.includes(">Подробнее<"), "«Подробнее» is a button that opens the preview");
  assert.ok(!html.includes("<a ") && !html.includes("target="), "no links out of the draft");
  const busy = renderToStaticMarkup(<ScenarioTimeline items={[museum]} busy onOpen={() => {}} onRemove={() => {}} onReplace={() => {}} />);
  assert.match(busy, /<button[^>]*disabled[^>]*aria-label="Подробнее о «Интерактивный музей»"|<button[^>]*aria-label="Подробнее о «Интерактивный музей»"[^>]*disabled/, "a preview is not opened while the draft is being rebuilt");
}
{
  const html = renderToStaticMarkup(<ReplaceOptionsList options={[{ fresh: puppets, items: [puppets] }]} onOpen={() => {}} onPick={() => {}} />);
  assert.ok(html.includes("Кукольный спектакль") && html.includes("Музей · 3+ · 12 BYN"));
  assert.ok(html.includes('aria-label="Посмотреть «Кукольный спектакль»"'), "a row opens the preview of the alternative");
  assert.ok(html.includes('aria-label="Выбрать «Кукольный спектакль»"'), "choosing is a separate button next to the row");
  assert.ok(!html.includes("<a ") && !html.includes("target="), "no new tab from the list");
}
{
  const target = museum;
  const options = [{ fresh: puppets, items: [puppets] }];
  const screen = renderToStaticMarkup(<ScenarioReplaceScreen target={target} options={options} loading={false} onBack={() => {}} onOpen={() => {}} onPick={() => {}} />);
  assert.ok(screen.includes("Чем заменить?") && screen.includes("Вместо «Интерактивный музей», около 10:30") && screen.includes("День"), "a screen with a way back, not a modal");
  assert.ok(!screen.includes('role="dialog"'), "not a dialog");
  const loading = renderToStaticMarkup(<ScenarioReplaceScreen target={target} options={null} loading onBack={() => {}} onOpen={() => {}} onPick={() => {}} />);
  assert.ok(loading.includes('aria-busy="true"'));
  const none = renderToStaticMarkup(<ScenarioReplaceScreen target={target} options={[]} loading={false} onBack={() => {}} onOpen={() => {}} onPick={() => {}} />);
  assert.ok(none.includes("Подходящих замен на это время нет"));
}

// ---- preview screen: what is already in the draft; "view" replaces/removes, "pick" takes the alternative
{
  const detailed = item("m2", "Музей науки", "2026-11-14T07:30:00Z", "2026-11-14T09:00:00Z", {
    card: { id: "m2", slug: "muzej-nauki", title: "Музей науки", coverImageUrl: "https://img.example/c.jpg", ageLabel: "6+", categoryName: "Музей", priceFrom: 12, priceTo: null, priceText: null, currency: "BYN", address: "ул. Мястровская 8", citySlug: "minsk" },
    scheduleUnconfirmed: true,
  });
  const view = renderToStaticMarkup(<ScenarioItemPreview item={detailed} city="minsk" back="День" onBack={() => {}} onReplace={() => {}} onRemove={() => {}} />);
  assert.ok(view.includes("Музей науки") && view.includes("6+") && view.includes("https://img.example/c.jpg"), "title, age, cover");
  assert.ok(view.includes("Суббота, 14 ноября · 10:30–12:00"), "day and time range in Minsk time");
  assert.ok(view.includes("ул. Мястровская 8") && view.includes("Музей · 12 BYN"), "address, category and price");
  assert.ok(view.includes("время по расписанию — уточните у организатора"), "what to double-check");
  assert.ok(view.includes('href="/minsk/events/muzej-nauki"') && view.includes('target="_blank"') && view.includes("откроется в новой вкладке"), "the public page is a new tab, the draft stays");
  assert.ok(view.includes(">Заменить<") && view.includes('aria-label="Убрать из дня"') && !view.includes("Выбрать это"), "view actions");
  const pick = renderToStaticMarkup(<ScenarioItemPreview item={detailed} city="minsk" back="Замена" onBack={() => {}} onPick={() => {}} />);
  assert.ok(pick.includes("Выбрать это") && !pick.includes(">Заменить<") && pick.includes("Замена"), "pick action only");
  const place = renderToStaticMarkup(<ScenarioItemPreview item={item("pl", "Игровая комната", "2026-11-14T12:40:00Z", "2026-11-14T14:10:00Z", { kind: "place" })} city="minsk" back="День" onBack={() => {}} onReplace={() => {}} />);
  assert.ok(place.includes("Место") && place.includes("Страница места") && place.includes('href="/minsk/places/pl"'), "a place links to its own page");
  const noCity = renderToStaticMarkup(<ScenarioItemPreview item={detailed} back="День" onBack={() => {}} onReplace={() => {}} />);
  assert.ok(noCity.includes('href="/minsk/events/muzej-nauki"'), "the item's own city is enough");
}

// ---- the saved day: banner, link to the other day, ⋯ menu
{
  const pair = { date: "2026-11-15", count: 2, direction: "next" as const };
  const weekend = renderToStaticMarkup(<SavedDayBanner date="2026-11-14" count={3} pair={pair} onOpenDate={() => {}} />);
  assert.ok(weekend.includes("Выходные от mamaGo · суббота") && weekend.includes("Воскресенье: 2 места →"), "a weekend day names its weekday and links to the other day");
  assert.ok(weekend.includes('aria-label="Действия с днём от mamaGo"'), "the ⋯ menu button is labelled");
  const lone = renderToStaticMarkup(<SavedDayBanner date="2026-11-14" count={3} pair={null} onOpenDate={() => {}} />);
  assert.ok(lone.includes("День от mamaGo · 3 места") && !lone.includes("→"), "a lone day: how many places, no link");
  assert.ok(!weekend.includes("Удалить"), "the menu is closed until opened");
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
  assert.doesNotMatch(shell, /KudaDayScenarioEntry/, "«Куда пойти» does not duplicate the day scenario entry");
  const screen = readFileSync("src/features/my-plan/components/dayScenario/DayScenarioScreen.tsx", "utf8");
  assert.match(screen, /<button type="button" disabled aria-describedby="scenario-save-hint"/, "a guest cannot save until PR 3c");
  assert.match(screen, /useDayScenarioSave\(\)/);
  assert.match(screen, /const canSave = !isGuest && Boolean\(activeDate\) && items\.length > 0 && !loading && !saving;/, "a member saves a shown, non-empty, settled draft");
  assert.match(screen, /requestPlanRefetchForDate\(activeDate\);[\s\S]{0,120}onBack\(\)/, "after a save the plan refetches the day and the widget goes back to it");
  assert.match(screen, /\{current \? \(\s*<div aria-busy/, "the action row is shown for any draft, also an emptied one (undo stays reachable)");
  assert.match(screen, /api\.goBack\(activeDate\)/);
  assert.match(screen, /disabled=\{loading \|\| exhausted\}[^>]*onClick=\{\(\) => activeDate && api\.another\(activeDate\)\}/, "«Другой вариант» is off while nothing new is left");
  assert.match(screen, /exhausted \? <AllShown/, "the «Мы показали всё» state is shown");
  assert.match(screen, /inert=\{views\.length > 0\}/, "the draft is inert under the stack");
  assert.match(screen, /<ScenarioReplaceScreen/, "«Чем заменить?» is a stack screen");
  assert.match(screen, /if \(staleStack\) closeStack\(\)/, "the stack closes when its point left the draft");
  assert.ok(!screen.includes("SaveFlowContainer") && !screen.includes("ScenarioReplaceSheet"), "no modal on top of the widget");
  assert.match(main, /<DayScenarioScreen[\s\S]*?city=\{city\}/, "the member screen gets the page's city");
  assert.match(main, /const savedDay = dayScenarioEnabled \? savedDays\[selectedDate\] : undefined;/, "the banner exists only with the flag on");
  assert.match(main, /\{renderPersonFilter\(false\)\}\s*\{savedDayBanner\}/, "the banner sits in the desktop layout");
  assert.match(main, /\{renderPersonFilter\(true\)\}\s*\{savedDayBanner\}/, "and in the mobile one");
  const ribbon = readFileSync("src/features/my-plan/components/v3/PlanDayRibbon.tsx", "utf8");
  assert.match(ribbon, /usePlanScenarioDays\(\{ from, to \}\)/, "the ribbon reads saved days from the cached chunks");
  assert.match(ribbon, /✦/, "a ✦ on days saved as «от mamaGo»");
  assert.match(ribbon, /sr-only">день от mamaGo/, "and the day says so to a screen reader");
  assert.match(main, /<DayScenarioScreen[\s\S]*?initialPersonaIds=\{selectedPersonaIds\}/, "«С кем идём?» starts from the page's «Для кого?»");
  assert.match(panel, /<DayScenarioScreen audience="guest" city=\{city\}/, "the guest screen gets the page's city");
}

console.log("dayScenario UI tests passed");
