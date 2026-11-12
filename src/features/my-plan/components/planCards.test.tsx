import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { isEditableNote, planItemLinkKind } from "../lib/planItemLink";
import { PlanItemRow } from "./PlanItemRow";
import { PlanEntryScreen, planEntryHref } from "./v3/PlanEntryScreen";
import { CatalogPreviewScreen, PreviewFooterButtons } from "./CatalogPreviewScreen";
import type { PlanItemWithActivity } from "../types/event";

const base = (over: Partial<PlanItemWithActivity>): PlanItemWithActivity => ({
  id: "i", userId: "u", activityId: null, date: "2026-11-14", startsAt: new Date("2026-11-14T08:00:00Z"), title: "Игровая комната", coverImageUrl: null, createdAt: new Date("2026-11-01"), activity: null, ...over,
});

// ---- the link decides the kind
assert.equal(planItemLinkKind({ activityId: "a" }), "activity");
assert.equal(planItemLinkKind({ activityId: null, articleId: "ar" }), "article");
assert.equal(planItemLinkKind({ activityId: null, placeId: "p" }), "place");
assert.equal(planItemLinkKind({ activityId: null, planPlaceSlug: "park" }), "place");
assert.equal(planItemLinkKind({ activityId: null, offerId: "o" }), "offer");
assert.equal(planItemLinkKind({ activityId: null, routeId: "r" }), "route");
assert.equal(planItemLinkKind({ activityId: null, source: "MANUAL" }), null);
assert.equal(isEditableNote({ activityId: null, source: "MANUAL" }), true);
assert.equal(isEditableNote({ activityId: null, source: "TELEGRAM_FORWARD" }), true, "a Telegram note can be opened");
assert.equal(isEditableNote({ activityId: null, source: "CATALOG" }), false, "an unlinked catalog leftover is not an editable note");
assert.equal(isEditableNote({ activityId: "a", source: "MANUAL" }), false, "a linked entry is a catalog card");

// ---- the row: a place point is tappable, has a cover when it has one, and says it is from mamaGo
{
  const place = base({ placeId: "p1", planPlaceSlug: "igrovaya", source: "CATALOG", scenarioId: "s1", timeType: "SUGGESTED", coverImageUrl: "https://img.example/p.jpg" });
  const html = renderToStaticMarkup(<PlanItemRow item={place} onRemove={() => {}} onOpen={() => {}} />);
  assert.ok(html.includes("https://img.example/p.jpg"), "the cover shows");
  assert.ok(/<button[^>]*type="button"[^>]*>Игровая комната<\/button>/.test(html), "the title opens the preview");
  assert.ok(html.includes("✦") && html.includes("от mamaGo"), "a scenario point is marked");
  const plain = renderToStaticMarkup(<PlanItemRow item={base({ placeId: "p1", source: "CATALOG" })} onRemove={() => {}} onOpen={() => {}} />);
  assert.ok(!plain.includes("от mamaGo"), "no mark on an ordinary entry");
  const telegram = renderToStaticMarkup(<PlanItemRow item={base({ source: "TELEGRAM_FORWARD", title: "Из бота" })} onRemove={() => {}} onOpen={() => {}} />);
  assert.ok(/<button[^>]*>Из бота<\/button>/.test(telegram), "a Telegram note opens its editor");
  const inert = renderToStaticMarkup(<PlanItemRow item={base({ title: "Старая запись", source: "CATALOG" })} onRemove={() => {}} onOpen={() => {}} />);
  assert.ok(!/<button[^>]*>Старая запись<\/button>/.test(inert), "an unlinked leftover stays inert");
}

// ---- the entry preview: place / offer / route built from the entry's own fields
{
  const place = base({ placeId: "p1", planPlaceSlug: "igrovaya-komnata", scenarioId: "s1", timeType: "SUGGESTED", locationText: "ул. Мястровская 8" });
  const html = renderToStaticMarkup(<PlanEntryScreen item={place} onBack={() => {}} onRemove={() => {}} onMove={() => {}} />);
  assert.ok(html.includes("Место") && html.includes("Игровая комната") && html.includes("ул. Мястровская 8"), "badge, title, address");
  assert.ok(html.includes("✦") && html.includes("время подобрал mamaGo, уточните"), "a suggested time says so");
  assert.ok(html.includes('aria-label="Удалить из плана"') && html.includes('aria-label="Перенести"'), "delete and move");
  assert.ok(html.includes('href="/minsk/places/igrovaya-komnata"') && html.includes("Открыть страницу места"), "the public page");
  const noMove = renderToStaticMarkup(<PlanEntryScreen item={place} onBack={() => {}} onRemove={() => {}} />);
  assert.ok(!noMove.includes('aria-label="Перенести"'));
  const offer = base({ offerId: "o1", offer: { id: "o1", title: "Абонемент", slug: "abonement", coverImage: "https://img.example/o.jpg", priceFrom: 40, priceText: null, place: { city: { slug: "grodno" } } }, title: "Абонемент" });
  const offerHtml = renderToStaticMarkup(<PlanEntryScreen item={offer} onBack={() => {}} onRemove={() => {}} />);
  assert.ok(offerHtml.includes("Предложение") && offerHtml.includes("https://img.example/o.jpg") && offerHtml.includes("от 40 BYN") && offerHtml.includes('href="/grodno/offers/abonement"'), "an offer: cover, price, its own city");
  const route = base({ routeId: "r1", title: "Прогулка по центру" });
  const routeHtml = renderToStaticMarkup(<PlanEntryScreen item={route} onBack={() => {}} onRemove={() => {}} />);
  assert.ok(routeHtml.includes("Маршрут") && !routeHtml.includes("<a "), "a route has no public page");
  assert.equal(planEntryHref(base({ planPlaceSlug: "../x", placeId: "p" }), "minsk"), null, "an unsafe slug is never put into a path");
}

// ---- one shared preview: every adapter goes through CatalogPreviewScreen
{
  for (const file of ["v3/PlanEventScreen.tsx", "v3/PlanArticleScreen.tsx", "v3/PlanEntryScreen.tsx", "dayScenario/ScenarioItemPreview.tsx"]) {
    const src = readFileSync(`src/features/my-plan/components/${file}`, "utf8");
    assert.ok(src.includes("<CatalogPreviewScreen"), `${file} uses the shared preview`);
    assert.ok(!src.includes("PlanScreenHead"), `${file} has no layout of its own`);
  }
  const shell = renderToStaticMarkup(<CatalogPreviewScreen back="План" onBack={() => {}} badge="Место" tone="place" fromScenario coverUrl={null} title="Парк" rows={[{ icon: "date", primary: "Суббота" }]} footer={<PreviewFooterButtons onRemove={() => {}} />} />);
  assert.ok(shell.includes("Парк") && shell.includes("✦") && shell.includes("Суббота"), "title, scenario chip, rows");
  const main = readFileSync("src/features/my-plan/components/PlanMainContent.tsx", "utf8");
  assert.match(main, /planItemLinkKind\(openedEvent\) !== "activity" \? \(\s*<PlanEntryScreen/, "place, offer and route entries open the entry preview");
  assert.match(main, /if \(planItemLinkKind\(item\) === null\) \{\s*if \(!isEditableNote\(item\)\) return;/, "an unlinked editable note opens its editor, a linked entry its preview");
}

console.log("plan cards tests passed");
