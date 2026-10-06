import assert from "node:assert/strict";
import {
  getSeoAdminSidebarItems,
  isSeoSettingsPath,
  SEO_FOUNDATION_NAV,
  SEO_PRIMARY_NAV,
  SEO_SETTINGS_ENTRY,
  SEO_SETTINGS_NAV,
  shouldShowSeoGeoContextSelector,
} from "./seoNavConfig";
import { GROUP_SEO } from "./adminSidebarConfig";
import { buildSeoPagesListResult } from "./seo/data/seoAdminData";
import type { SeoPage } from "./seo/domain/types";
import {
  presentSeoMarket,
  resolveSeoMarketFilter,
  enrichMarketFilterWithRegionCities,
} from "./seo/geo/seoMarket";

const sidebar = getSeoAdminSidebarItems();
assert.deepEqual(
  sidebar.map((i) => i.label),
  ["Обзор", "Страницы", "План контента", "Темы и тренды", "Настройки SEO"],
);
assert.equal(sidebar.at(-1)?.href, SEO_SETTINGS_ENTRY.href);

for (const label of ["Контент", "Поиск", "Индексация", "Редиректы", "AI Search"]) {
  assert.equal(
    sidebar.some((i) => i.label === label),
    false,
    `${label} must not be first-level sidebar item`,
  );
}

assert.ok(SEO_FOUNDATION_NAV.some((i) => i.label === "Контент"));
assert.ok(SEO_PRIMARY_NAV.every((item) => sidebar.some((s) => s.href === item.href)));

assert.deepEqual(
  GROUP_SEO.children.map((c) => c.label),
  ["Обзор", "Страницы", "План контента", "Темы и тренды", "Настройки SEO"],
);

assert.equal(shouldShowSeoGeoContextSelector("/admin/seo"), true);
assert.equal(shouldShowSeoGeoContextSelector("/admin/seo/pages"), true);
assert.equal(shouldShowSeoGeoContextSelector("/admin/seo/plan"), true);
assert.equal(shouldShowSeoGeoContextSelector("/admin/seo/topics"), true);
assert.equal(shouldShowSeoGeoContextSelector("/admin/seo/settings/indexation"), false);

const minskCtx = {
  kind: "city" as const,
  cityId: "c1",
  citySlug: "minsk",
  cityName: "Минск",
  regionId: "r1",
  regionName: "Минская область",
  countryId: "by",
  countryName: "Беларусь",
};
const presented = presentSeoMarket(minskCtx);
assert.equal(presented.marketLabel, "Минск + Минская область");
assert.equal(presented.supportsMarketScopes, true);

const marketFilter = enrichMarketFilterWithRegionCities(
  resolveSeoMarketFilter(minskCtx, "market"),
  [
    { id: "c1", slug: "minsk" },
    { id: "c2", slug: "zhodino" },
  ],
);
assert.equal(marketFilter.kind, "market");
if (marketFilter.kind === "market") {
  assert.ok(marketFilter.cityIds.includes("c1"));
  assert.ok(marketFilter.cityIds.includes("c2"));
  assert.equal(new Set(marketFilter.cityIds).size, marketFilter.cityIds.length);
}

const cityOnly = resolveSeoMarketFilter(minskCtx, "city");
assert.equal(cityOnly.kind, "city");

const pages: SeoPage[] = Array.from({ length: 30 }, (_, i) => ({
  id: `entity:place:${i}`,
  path: `/minsk/places/p-${i}`,
  section: "kuda",
  type: "place",
  filtersSnapshot: { citySlug: "minsk", cityId: "c1", geoScope: "CITY" },
  title: `Place ${i}`,
  h1: `Place ${i}`,
  description: "d",
  isIndexable: true,
  canonical: null,
  updatedAt: new Date().toISOString(),
  indexationStatus: i % 2 === 0 ? "indexed" : "noindex",
}));

const page1 = buildSeoPagesListResult(pages, { kind: "city", cityId: "c1", citySlug: "minsk" }, { page: 1, pageSize: 25 });
assert.equal(page1.pagination.total, 30);
assert.equal(page1.items.length, 25);

for (const technical of SEO_SETTINGS_NAV) {
  assert.equal(sidebar.some((i) => i.label === technical.label), false);
}
assert.equal(isSeoSettingsPath("/admin/seo/settings/indexation"), true);

console.log("seoNavConfig contract: PASS");
