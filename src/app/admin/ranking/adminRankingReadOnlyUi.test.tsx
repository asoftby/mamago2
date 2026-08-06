/**
 * UI regression tests for the safety-fix lockdown of the legacy ranking pages.
 *
 * No React test harness in this repo (no testing-library/jsdom) — same
 * approach as src/components/ui/table.test.tsx and
 * src/components/city/DiscoveryIntentTabs.test.tsx: static-render the reusable
 * Toggle primitive via react-dom/server for markup/a11y assertions, and use
 * source-text assertions (same technique as
 * src/app/admin/ranking/stories-intents/storiesRouteIntegration.test.ts) for
 * the page components themselves, since useEffect (where the old Save/Reset
 * handlers used to live and where data now loads) never runs under
 * renderToStaticMarkup — a static render of these pages would only ever show
 * the permanent loading branch and couldn't prove a mutation control is gone
 * from the loaded branch too.
 *
 * Запуск: npx tsx src/app/admin/ranking/adminRankingReadOnlyUi.test.tsx
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { Toggle } from "@/components/ui/Toggle";

// --- Toggle primitive: disabled state must be real, keyboard-semantic <button disabled> ---
{
  const html = renderToStaticMarkup(
    <Toggle checked disabled onChange={() => {}} aria-label="Буст в «Сегодня»" />,
  );
  assert.match(html, /<button/, "Toggle must render a native <button> for keyboard/a11y semantics");
  assert.match(html, /\sdisabled(=""|\s|>)/, "disabled Toggle must carry the native disabled attribute");
  assert.match(html, /aria-label="Буст в «Сегодня»"/);
}

const weightsPage = readFileSync("src/app/admin/ranking/weights/page.tsx", "utf8");
const boostPage = readFileSync("src/app/admin/ranking/boost/page.tsx", "utf8");
const searchRankingPage = readFileSync("src/app/admin/search/ranking/page.tsx", "utf8");
const storyIntentPanel = readFileSync("src/app/admin/ranking/stories-intents/StoryIntentRulesPanel.tsx", "utf8");

function assertLockedReadOnly(source: string, label: string) {
  assert.doesNotMatch(source, /method:\s*"POST"/, `${label} must not POST a mutation anymore`);
  assert.doesNotMatch(source, /method:\s*"PATCH"/, `${label} must not PATCH a mutation anymore`);
  assert.doesNotMatch(source, /Сохранить/, `${label} must not offer a save button`);
  assert.doesNotMatch(source, /Save Changes/, `${label} must not offer a save button`);
  assert.doesNotMatch(source, />\s*Reset/i, `${label} must not offer a reset control`);
  assert.match(source, /только для чтения/i, `${label} must explain the read-only state to the admin`);
}

// --- RankingWeightsPage / BoostRulesPage / search RankingPage: locked, no mutation controls ---
assertLockedReadOnly(weightsPage, "weights/page.tsx");
assertLockedReadOnly(boostPage, "boost/page.tsx");
assertLockedReadOnly(searchRankingPage, "search/ranking/page.tsx");

// boost/page.tsx: toggles are rendered disabled, not interactive.
assert.match(boostPage, /<Toggle[\s\S]*?disabled[\s\S]*?\/>/, "boost toggles must be rendered disabled");
assert.doesNotMatch(boostPage, /onChange=\{.*setSettings/, "boost toggles must not still mutate local state via onChange");

// weights/page.tsx: no editable <input type="range"/number"> left for the weight sliders.
assert.doesNotMatch(weightsPage, /type="range"/);
assert.doesNotMatch(weightsPage, /<Input/);

// search/ranking/page.tsx: slider replaced by a static bar, no onChange wiring to settings.
assert.doesNotMatch(searchRankingPage, /type="range"/);
assert.doesNotMatch(searchRankingPage, /handleChange\(/);

// --- StoryIntentRulesPanel: the one live, still-editable panel keeps its Save
//     control and gets a clear conflict message + fresh reload on 409. ---
assert.match(storyIntentPanel, /Сохранить/, "the live intent-rules panel must keep its Save control");
assert.match(storyIntentPanel, /res\.status === 409/, "must branch on a concurrency conflict");
assert.match(storyIntentPanel, /await load\(\)/, "a conflict must refresh from the server, not keep stale local state");
assert.match(storyIntentPanel, /toast\.error\(/, "a conflict must be surfaced to the admin, not swallowed");

console.log("admin ranking read-only UI tests: OK");
