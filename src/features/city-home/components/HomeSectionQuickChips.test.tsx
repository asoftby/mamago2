import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { HomeEventsQuickChips } from "./HomeSectionQuickChips";

test("home event chips link to date-filtered catalog, not to local carousel toggles", () => {
  const router = { back() {}, forward() {}, refresh() {}, push() {}, replace() {}, prefetch() {} };
  const html = renderToStaticMarkup(<AppRouterContext.Provider value={router as never}><HomeEventsQuickChips citySlug="minsk" /></AppRouterContext.Provider>);
  assert.match(html, /Сегодня/);
  assert.match(html, /Завтра/);
  assert.match(html, /На выходных/);
  assert.match(html, /preset=TODAY/);
  assert.match(html, /preset=TOMORROW/);
  assert.match(html, /preset=WEEKEND/);
  assert.match(html, /\/minsk\/events/);
});
