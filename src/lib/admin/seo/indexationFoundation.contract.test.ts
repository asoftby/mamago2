import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const indexationClient = readFileSync(
  join(root, "src/components/admin/seo/IndexationSettingsClient.tsx"),
  "utf8",
);
const indexationPage = readFileSync(
  join(root, "src/app/admin/seo/settings/indexation/page.tsx"),
  "utf8",
);
const contentPage = readFileSync(
  join(root, "src/app/admin/seo/content/page.tsx"),
  "utf8",
);
const searchPage = readFileSync(
  join(root, "src/app/admin/seo/search/page.tsx"),
  "utf8",
);

assert.match(indexationPage, /IndexationSettingsClient/);
assert.doesNotMatch(indexationClient, /SitemapRobotsCenterClient/);
assert.doesNotMatch(indexationClient, /REGEN_LABEL/);
assert.doesNotMatch(indexationClient, /Готово/);
assert.doesNotMatch(indexationClient, /Indexed pages/);
assert.doesNotMatch(indexationClient, /Last generated/);
assert.doesNotMatch(indexationClient, /<Switch/);
assert.doesNotMatch(indexationClient, /disabled/);
assert.match(indexationClient, /Управляется конфигурацией окружения/);
assert.match(indexationClient, /Открыть robots\.txt/);
assert.match(indexationClient, /Открыть sitemap\.xml/);
assert.match(indexationClient, /Технические детали/);

assert.match(contentPage, /redirect\(/);
assert.match(searchPage, /redirect\(/);
assert.doesNotMatch(contentPage, /SeoContentFoundationClient/);
assert.doesNotMatch(searchPage, /SeoSearchFoundationClient/);

console.log("seo indexation/foundation contract: PASS");
