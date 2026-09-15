import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { PRIMARY_NAVIGATION_ITEMS } from "@/lib/discovery/discoveryIntentConfig";
import { FooterPrimaryNavigationList } from "./FooterPrimaryNavigation";

const availableItems = PRIMARY_NAVIGATION_ITEMS.filter(
  (item) => item.navigationEnabled && !item.comingSoon,
);
const html = renderToStaticMarkup(
  <FooterPrimaryNavigationList items={availableItems} citySlug="minsk" />,
);

assert.ok(html.includes('<nav aria-label="Разделы"'));
assert.deepEqual(
  availableItems.map((item) => item.label),
  ["Куда пойти", "Журнал"],
);
assert.ok(html.includes('href="/minsk/events"'));
assert.ok(html.includes('href="/minsk/blog"'));
assert.equal(html.split('aria-hidden="true"').length - 1, 1);
assert.ok(html.includes("lowercase"));

// Layout contract with all five entries: no wrapping on desktop; mobile may wrap,
// while decorative separators remain hidden below 769px so they cannot dangle.
const fiveItemHtml = renderToStaticMarkup(
  <FooterPrimaryNavigationList items={PRIMARY_NAVIGATION_ITEMS} citySlug="minsk" />,
);
assert.equal(fiveItemHtml.split("<li").length - 1, 5);
assert.equal(fiveItemHtml.split('aria-hidden="true"').length - 1, 4);
assert.ok(fiveItemHtml.includes("min-[769px]:flex-nowrap"));
assert.equal(fiveItemHtml.split("hidden opacity-70 min-[769px]:inline").length - 1, 4);

console.log("FooterPrimaryNavigation.test.tsx: OK");
