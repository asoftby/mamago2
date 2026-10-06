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

const sidebar = getSeoAdminSidebarItems();
assert.deepEqual(
  sidebar.map((i) => i.label),
  ["Обзор", "Страницы", "Настройки SEO"],
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
assert.ok(SEO_FOUNDATION_NAV.some((i) => i.label === "Поиск"));
assert.ok(SEO_PRIMARY_NAV.every((item) => sidebar.some((s) => s.href === item.href)));

assert.deepEqual(
  GROUP_SEO.children.map((c) => c.label),
  ["Обзор", "Страницы", "Настройки SEO"],
);

assert.equal(shouldShowSeoGeoContextSelector("/admin/seo"), true);
assert.equal(shouldShowSeoGeoContextSelector("/admin/seo/pages"), true);
assert.equal(shouldShowSeoGeoContextSelector("/admin/seo/pages/event/1"), true);
assert.equal(shouldShowSeoGeoContextSelector("/admin/seo/content"), false);
assert.equal(shouldShowSeoGeoContextSelector("/admin/seo/search"), false);
assert.equal(shouldShowSeoGeoContextSelector("/admin/seo/settings"), false);
assert.equal(shouldShowSeoGeoContextSelector("/admin/seo/settings/indexation"), false);
assert.equal(shouldShowSeoGeoContextSelector("/admin/seo/settings/redirects"), false);
assert.equal(shouldShowSeoGeoContextSelector("/admin/seo/settings/schema"), false);
assert.equal(shouldShowSeoGeoContextSelector("/admin/seo/settings/ai-search"), false);
assert.equal(isSeoSettingsPath("/admin/seo/settings/indexation"), true);

for (const technical of SEO_SETTINGS_NAV) {
  assert.equal(sidebar.some((i) => i.label === technical.label), false);
}

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

const geo = {
  kind: "city" as const,
  cityId: "c1",
  citySlug: "minsk",
  cityName: "Минск",
  regionId: null,
  regionName: null,
  countryId: "by",
  countryName: "Беларусь",
};

const page1 = buildSeoPagesListResult(pages, geo, { page: 1, pageSize: 25 });
assert.equal(page1.pagination.total, 30);
assert.equal(page1.pagination.totalPages, 2);
assert.equal(page1.items.length, 25);
assert.equal(page1.pagination.start, 1);
assert.equal(page1.pagination.end, 25);

const page2 = buildSeoPagesListResult(pages, geo, { page: 2, pageSize: 25 });
assert.equal(page2.items.length, 5);
assert.equal(page2.pagination.start, 26);
assert.equal(page2.pagination.end, 30);

const filtered = buildSeoPagesListResult(pages, geo, {
  page: 1,
  pageSize: 25,
  indexation: "noindex",
});
assert.equal(filtered.pagination.total, 15);

console.log("seoNavConfig contract: PASS");
