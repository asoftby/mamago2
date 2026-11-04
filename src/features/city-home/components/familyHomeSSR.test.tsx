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
  assert.match(html, /На этой неделе/);
  assert.doesNotMatch(html, /Выберите возраст|Возраст ребёнка|3–5 лет|Для кого:|Добавить ребёнка/);
  assert.match(html, /Пока нет опубликованных событий/);
  assert.match(html, /Еще варианты/);
  assert.match(html, /Куда пойти/);
  assert.doesNotMatch(html, /Для вашей семьи|child_000|Зарегистрируйтесь/);
});

test("guest events use a uniform poster height without cropping and have one final catalog card", () => {
  const event = { id: "event_guest", title: "Событие", citySlug: "minsk", image: null, href: "/minsk/events/event_guest" };
  const html = renderToStaticMarkup(<AppRouterContext.Provider value={router}><AuthProvider initialUser={null}>
    <CityHomeGeneralEvents activities={[event] as never} citySlug="minsk" />
  </AuthProvider></AppRouterContext.Provider>);
  assert.match(html, /aspect-ratio:2\/3/);
  assert.match(html, /Еще варианты/);
  assert.equal((html.match(/Еще варианты/g) ?? []).length, 1);
});

test("logged-in no-child state shows add-child action, but never age filters", () => {
  const html = renderToStaticMarkup(<AppRouterContext.Provider value={router}><AuthProvider initialUser={{ id: "account_a" } as never}>
    <CityHomeGeneralEvents activities={[]} citySlug="minsk" authenticated />
  </AuthProvider></AppRouterContext.Provider>);
  assert.match(html, /События, которые подходят вам/);
  assert.match(html, /На этой неделе/);
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
    assert.match(html, /События, которые подходят вам/);
    assert.match(html, /aria-busy="true"/);
    assert.match(html, /Подбираем события/);
    assert.equal((html.match(/aria-pressed=/g) ?? []).length, count + 1);
    assert.match(html, /\+ Ребёнок/);
    assert.match(html, /Для кого:/);
    assert.match(html, /Для всех/);
    assert.match(html, /Ребёнок 0/);
    assert.match(html, />Я</);
    assert.doesNotMatch(html, /Куда пойти с ребёнком|Зарегистрируйтесь|mg_family_picks_dismissed/);
  });
}

test("family chips display youngest children, then active adult, then me", () => {
  const context: HomeFamilyContext = { actorId: "account_a", signature: "a".repeat(64), day: "2030-11-02",
    policyVersion: "v2", audience: "personalized", selectedChildId: null, preferenceVersion: null, selectionPersistence: "account",
    children: [
      { id: "old", name: "Таисия", ageMonths: 96, hasBirthDate: true, ageFilter: ["7-9"] },
      { id: "young", name: "Степан", ageMonths: 50, hasBirthDate: true, ageFilter: ["3-5"] },
    ],
    adults: [{ name: "Таня", isMe: false }],
  };
  const html = renderToStaticMarkup(<AppRouterContext.Provider value={router}><AuthProvider initialUser={{ id: "account_a" } as never}>
    <CityHomeFamilyPicks citySlug="minsk" initialContext={context} />
  </AuthProvider></AppRouterContext.Provider>);
  for (const fragment of [">Для всех<", ">Степан<", ">Таисия<", ">Таня<", ">Я<"]) {
    assert.ok(html.includes(fragment), fragment);
  }
  assert.ok(html.indexOf(">Степан<") < html.indexOf(">Таисия<"));
  assert.ok(html.indexOf(">Таисия<") < html.indexOf(">Таня<"));
  assert.ok(html.indexOf(">Таня<") < html.indexOf(">Я<"));
  assert.match(html, /age=18%2B/, "adult chip leads to real adult catalog, not a fake per-adult feed");
});

for (const count of [0, 1, 2, 7, 8, 10, 11]) {
  test(`real ready HTML with ${count} events has one final catalog CTA and one save per visible event`, () => {
    const context: HomeFamilyContext = { actorId: "account_a", signature: "a".repeat(64), day: "2030-11-02", policyVersion: "v2", audience: "personalized", selectedChildId: null, preferenceVersion: null, selectionPersistence: "account",
      children: [{ id: "child_0001", name: "Аня", hasBirthDate: true, ageFilter: ["3-5"] }] };
    const data = { context, window: { horizonDays: 30, dateFrom: "2030-11-02", dateTo: "2030-12-01" }, runId: "run_123", policyVersion: "family-picks-confirmed-v3", sharedAlgorithmVersion: "test", candidateCount: count, selection: { mode: "ALL_FAMILY" }, status: count ? "READY" : "EMPTY", items: Array.from({ length: count }, (_, i) => ({
      id: `event_${i}`, title: `Тестовое событие ${i}`, href: `/minsk/events/event_${i}`, imageUrl: null, imageWidth: 600, imageHeight: 900,
      categoryName: "Театр", agePolicy: "SPECIFIC", ageMinMonths: 36, ageMaxMonths: 168, priceMode: i % 2 ? "RANGE" : "FREE", priceFrom: 10, priceTo: 20, currency: "BYN",
      startsAt: "2030-11-02T22:30:00Z", allChildrenMatch: i === 0, matchedChildIds: ["child_0001"], exposureId: `exposure_${i}`, position: i + 1, score: 1,
    })) } as import("@/server/services/recommendations/familyPicks/delivery").HomeFamilyDelivery;
    const html = renderToStaticMarkup(<AppRouterContext.Provider value={router}><AuthProvider initialUser={{ id: "account_a" } as never}>
      <FamilyHomeResults data={data} context={context} citySlug="minsk" selected={null} impressed={new Set()} onImpression={() => {}} onDismiss={() => {}} onSave={() => {}} />
    </AuthProvider></AppRouterContext.Provider>);
    const visible = Math.min(count, 10);
    assert.equal((html.match(/>В мой план</g) ?? []).length, visible);
    assert.equal((html.match(/>Не подходит</g) ?? []).length, visible);
    assert.equal((html.match(/Еще варианты</g) ?? []).length, 1);
    assert.ok(html.lastIndexOf("Еще варианты") > html.lastIndexOf("Не подходит"));
    assert.doesNotMatch(html, /child_0001|profile=|kids=/);
    if (!count) assert.match(html, /30 дней нет подтверждённых событий/);
    else { assert.match(html, /3–14 · 3 ноя./); assert.match(html, /Бесплатно/); assert.match(html, /Подходит всем/);
      assert.match(html, /aspect-ratio:2\/3/); }
    if (count > 1) { assert.match(html, /Подходит: Аня/); assert.match(html, /от 10/); }
  });
}
