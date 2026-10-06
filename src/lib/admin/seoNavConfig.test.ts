import assert from "node:assert/strict";
import {
  getSeoAdminSidebarItems,
  isSeoSettingsPath,
  SEO_PRIMARY_NAV,
  SEO_SETTINGS_ENTRY,
  SEO_SETTINGS_NAV,
  shouldShowSeoGeoContextSelector,
} from "./seoNavConfig";
import { GROUP_SEO } from "./adminSidebarConfig";

const sidebar = getSeoAdminSidebarItems();
assert.deepEqual(
  sidebar.map((i) => i.label),
  ["Обзор", "Контент", "Страницы", "Поиск", "Настройки SEO"],
);
assert.equal(sidebar.at(-1)?.href, SEO_SETTINGS_ENTRY.href);
assert.equal(SEO_SETTINGS_ENTRY.href, "/admin/seo/settings/indexation");

for (const technical of SEO_SETTINGS_NAV) {
  assert.equal(
    sidebar.some((i) => i.href === technical.href && i.label === technical.label),
    false,
    `technical item ${technical.label} must not appear in main sidebar`,
  );
}

assert.ok(SEO_PRIMARY_NAV.every((item) => sidebar.some((s) => s.href === item.href)));

assert.deepEqual(
  GROUP_SEO.children.map((c) => c.label),
  ["Обзор", "Контент", "Страницы", "Поиск", "Настройки SEO"],
);
assert.equal(GROUP_SEO.children.at(-1)?.href, SEO_SETTINGS_ENTRY.href);
assert.ok(
  !GROUP_SEO.children.some((c) =>
    [
      "Индексация",
      "Редиректы",
      "Структурированные данные",
      "AI Search",
      "Templates",
      "llms.txt",
      "Dashboard",
      "SEO Pages",
    ].includes(c.label),
  ),
);

assert.equal(isSeoSettingsPath("/admin/seo/settings/indexation"), true);
assert.equal(isSeoSettingsPath("/admin/seo/settings/redirects"), true);
assert.equal(isSeoSettingsPath("/admin/seo/pages"), false);
assert.equal(shouldShowSeoGeoContextSelector("/admin/seo"), true);
assert.equal(shouldShowSeoGeoContextSelector("/admin/seo/content"), true);
assert.equal(shouldShowSeoGeoContextSelector("/admin/seo/pages"), true);
assert.equal(shouldShowSeoGeoContextSelector("/admin/seo/search"), true);
assert.equal(shouldShowSeoGeoContextSelector("/admin/seo/settings"), false);
assert.equal(shouldShowSeoGeoContextSelector("/admin/seo/settings/indexation"), false);
assert.equal(shouldShowSeoGeoContextSelector("/admin/seo/settings/ai-search"), false);

console.log("seoNavConfig contract: PASS");
