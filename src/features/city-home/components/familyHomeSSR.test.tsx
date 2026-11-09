import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { AuthProvider } from "@/lib/auth/AuthProvider";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
// next/font is transformed by Next at build time; isolate only that transform.
const fontModule = require.resolve("next/font/local");
const previousFont = require.cache[fontModule];
require.cache[fontModule] = { id: fontModule, filename: fontModule, loaded: true, exports: { __esModule: true, default: () => ({ style: { fontFamily: "serif" }, className: "test-font", variable: "test-font" }) } } as NodeModule;
const { CityHomeGeneralEvents } = require("./CityHomeGeneralEvents") as typeof import("./CityHomeGeneralEvents");
const { HomeEventsBoundary } = require("./HomeEventsBoundary") as typeof import("./HomeEventsBoundary");
const { CityHomeFamilyPicks, FamilyHomeResults } = require("./CityHomeFamilyPicks") as typeof import("./CityHomeFamilyPicks");
if (previousFont) require.cache[fontModule] = previousFont;
else delete require.cache[fontModule];
import type { HomeFamilyContext } from "../lib/familyHome";
const router = { bfcacheId: "test", back() {}, forward() {}, refresh() {}, hmrRefresh() {}, push() {}, replace() {}, prefetch() {} };

test("guest afisha has no age chips or extra registration flow", () => {
  const html = renderToStaticMarkup(<AppRouterContext.Provider value={router}><AuthProvider initialUser={null}>
    <CityHomeGeneralEvents activities={[]} citySlug="minsk" />
  </AuthProvider></AppRouterContext.Provider>);
  assert.match(html, /Куда пойти с ребёнком в Минске/);
  assert.doesNotMatch(html, /На этой неделе|На ближайшие 7 дней/);
  assert.doesNotMatch(html, /Выберите возраст|Возраст ребёнка|3–5 лет|Для кого:|Добавить ребёнка/);
  assert.match(html, /Пока нет опубликованных событий/);
  assert.doesNotMatch(html, /По вашему запросу мы ничего не нашли|Больше под ваш запрос/);
  assert.match(html, /Куда пойти/);
  assert.doesNotMatch(html, /Для вашей семьи|child_000|Зарегистрируйтесь/);
});

test("guest events use a uniform poster height without cropping and have one final catalog card", () => {
  const event = { id: "event_guest", title: "Событие", citySlug: "minsk", image: null, href: "/minsk/events/event_guest" };
  const html = renderToStaticMarkup(<AppRouterContext.Provider value={router}><AuthProvider initialUser={null}>
    <CityHomeGeneralEvents activities={[event] as never} citySlug="minsk" />
  </AuthProvider></AppRouterContext.Provider>);
  assert.match(html, /aspect-ratio:2\/3/);
  assert.match(html, /Ещё варианты/);
  assert.equal((html.match(/Ещё варианты/g) ?? []).length, 1);
});

test("public fallback is labeled as nearest events, not this week", () => {
  const html = renderToStaticMarkup(<AppRouterContext.Provider value={router}><AuthProvider initialUser={null}>
    <CityHomeGeneralEvents activities={[]} citySlug="minsk" periodLabel="Ближайшие события" />
  </AuthProvider></AppRouterContext.Provider>);
  assert.doesNotMatch(html, /На ближайшие 7 дней/);
  assert.doesNotMatch(html, /На этой неделе/);
});

test("logged-in no-child state shows add-child action, but never age filters", () => {
  const html = renderToStaticMarkup(<AppRouterContext.Provider value={router}><AuthProvider initialUser={{ id: "account_a" } as never}>
    <CityHomeGeneralEvents activities={[]} citySlug="minsk" authenticated />
  </AuthProvider></AppRouterContext.Provider>);
  assert.match(html, /События, которые подходят вашей семье/);
  assert.doesNotMatch(html, /На этой неделе|На ближайшие 7 дней/);
  assert.match(html, /Добавить ребёнка/);
  assert.doesNotMatch(html, /Возраст ребёнка|3–5 лет|Выберите возраст/);
});

test("logged-in common fallback with existing children never suggests duplicate onboarding", () => {
  const html = renderToStaticMarkup(<AppRouterContext.Provider value={router}><AuthProvider initialUser={{ id: "account_a" } as never}>
    <CityHomeGeneralEvents activities={[]} citySlug="minsk" authenticated hasChildren />
  </AuthProvider></AppRouterContext.Provider>);
  assert.doesNotMatch(html, /Добавьте ребёнка|\+ Добавить ребёнка/);
});

test("logged-in child without DOB edits the existing child instead of adding a duplicate", () => {
  const html = renderToStaticMarkup(<AppRouterContext.Provider value={router}><AuthProvider initialUser={{ id: "account_a" } as never}>
    <CityHomeGeneralEvents activities={[]} citySlug="minsk" authenticated incompleteChild={{ id: "child_incomplete", name: "Степан" }} />
  </AuthProvider></AppRouterContext.Provider>);
  assert.match(html, /Указать возраст/);
  assert.doesNotMatch(html, /\+ Добавить ребёнка/);
});

test("Home boundary never renders another account's events on the server", () => {
  const html = renderToStaticMarkup(<AppRouterContext.Provider value={router}><AuthProvider initialUser={{ id: "current" } as never}>
    <HomeEventsBoundary actorId="old" citySlug="minsk"><p>Old account private events</p></HomeEventsBoundary>
  </AuthProvider></AppRouterContext.Provider>);
  assert.doesNotMatch(html, /Old account private events/);
  assert.match(html, /Подбираем мероприятия/);
});

for (const count of [1, 2, 3, 5, 7]) {
  test(`personal SSR with ${count} children has a stable skeleton, correct chips and no common flash`, () => {
    const context: HomeFamilyContext = { actorId: "account_a", signature: "a".repeat(64), day: "2030-11-02", policyVersion: "v2", audience: "personalized",
      selectedChildId: null, preferenceVersion: null, selectionPersistence: "account",
      children: Array.from({ length: count }, (_, i) => ({ id: `child_000${i}`, name: `Ребёнок ${i}`, hasBirthDate: i !== 1, ageYears: i === 0 ? 6 : null, ageFilter: [] })) };
    const html = renderToStaticMarkup(<AppRouterContext.Provider value={router}><AuthProvider initialUser={{ id: "account_a" } as never}>
      <CityHomeFamilyPicks citySlug="minsk" initialContext={context} />
    </AuthProvider></AppRouterContext.Provider>);
    assert.match(html, /События, которые подходят вашей семье/);
    assert.doesNotMatch(html, /На ближайшие 7 дней/, "the visible heading must not impose a 7-day window");
    assert.match(html, /aria-busy="true"/);
    assert.match(html, /Подбираем события/);
    assert.doesNotMatch(html, /Для кого:|Для всех|aria-pressed|>Я</);
    assert.doesNotMatch(html, /Куда пойти с ребёнком|Зарегистрируйтесь|mg_family_picks_dismissed/);
  });
}

for (const count of [0, 1, 2, 7, 8, 10, 11]) {
  test(`real ready HTML with ${count} events has one final poster card and no extra actions`, () => {
    const context: HomeFamilyContext = { actorId: "account_a", signature: "a".repeat(64), day: "2030-11-02", policyVersion: "v2", audience: "personalized", selectedChildId: null, preferenceVersion: null, selectionPersistence: "account",
      children: [{ id: "child_0001", name: "Аня", hasBirthDate: true, ageFilter: ["3-5"] }] };
    const data = { context, window: { horizonDays: 30, dateFrom: "2030-11-02", dateTo: "2030-12-01" }, runId: "run_123", policyVersion: "family-picks-confirmed-v3", sharedAlgorithmVersion: "test", candidateCount: count, hasCatalogEvents: count > 0, selection: { mode: "ALL_FAMILY" }, status: count ? "READY" : "EMPTY", items: Array.from({ length: count }, (_, i) => ({
      id: `event_${i}`, title: `Тестовое событие ${i}`, href: `/minsk/events/event_${i}`, imageUrl: null, imageWidth: 600, imageHeight: 900,
      categoryName: "Театр", agePolicy: "SPECIFIC", ageMinMonths: 36, ageMaxMonths: 168, priceMode: i % 2 ? "RANGE" : "FREE", priceFrom: 10, priceTo: 20, currency: "BYN",
      startsAt: "2030-11-02T22:30:00Z", allChildrenMatch: i === 0, matchedChildIds: ["child_0001"], exposureId: `exposure_${i}`, position: i + 1, score: 1,
    })) } as import("@/server/services/recommendations/familyPicks/delivery").HomeFamilyDelivery;
    const html = renderToStaticMarkup(<AppRouterContext.Provider value={router}><AuthProvider initialUser={{ id: "account_a" } as never}>
      <FamilyHomeResults data={data} context={context} citySlug="minsk" impressed={new Set()} onImpression={() => {}} />
    </AuthProvider></AppRouterContext.Provider>);
    const visible = Math.min(count, 10);
    assert.doesNotMatch(html, /В мой план|Не подходит/);
    assert.equal((html.match(/Сохранить в план или в идеи/g) ?? []).length, visible);
    assert.equal((html.match(/data-masonry-media=/g) ?? []).length, visible);
    assert.equal((html.match(/Ещё варианты</g) ?? []).length, count ? 1 : 0);
    if (count) assert.ok(html.lastIndexOf("Ещё варианты") > html.lastIndexOf("Тестовое событие"));
    assert.doesNotMatch(html, /child_0001|profile=|kids=/);
    if (!count) assert.match(html, /Пока нет опубликованных событий/);
    else { assert.match(html, /3–14 лет · 3 ноя./); assert.match(html, /Бесплатно/); assert.doesNotMatch(html, /Подходит Ане/);
      assert.match(html, /aspect-ratio:2\/3/); }
    if (count > 1) { assert.doesNotMatch(html, /Подходит Ане/); assert.match(html, /от 10/); }
    if (count === 7) {
      const htmlWithAlternatives = renderToStaticMarkup(
        <AppRouterContext.Provider value={router}><AuthProvider initialUser={{ id: "account_a" } as never}>
          <FamilyHomeResults data={data} context={context} citySlug="minsk" impressed={new Set()} onImpression={() => {}}
            audienceSections={{ primary: data.items.slice(0, 1), alternatives: data.items.slice(1), active: true }} />
        </AuthProvider></AppRouterContext.Provider>,
      );
      assert.equal((htmlWithAlternatives.match(/data-masonry-media=/g) ?? []).length, 7);
      assert.doesNotMatch(htmlWithAlternatives, /Больше под ваш запрос|Справа — другие|По выбранным параметрам/);
      assert.equal((htmlWithAlternatives.match(/Ещё варианты</g) ?? []).length, 1);
    }
  });
}
