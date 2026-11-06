import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { HomeEventsQuickChips } from "./HomeSectionQuickChips";

test("home event chips link to date-filtered catalog, not to local carousel toggles", () => {
  const router = { back() {}, forward() {}, refresh() {}, push() {}, replace() {}, prefetch() {} };
  const html = renderToStaticMarkup(<AppRouterContext.Provider value={router as never}><HomeEventsQuickChips citySlug="minsk" /></AppRouterContext.Provider>);
  assert.match(html, /\bh-11\b/);
  assert.match(html, /\bpx-5\b/);
  assert.doesNotMatch(html, /\bmin-h-10\b/);
  assert.match(html, /сегодня/);
  assert.match(html, /завтра/);
  assert.match(html, /на выходных/);
  assert.match(html, /preset=today/);
  assert.match(html, /preset=tomorrow/);
  assert.match(html, /preset=weekend/);
  assert.match(html, /\/minsk\/events/);
});
