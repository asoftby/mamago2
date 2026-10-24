import assert from "node:assert/strict";
import {
  parseLastPublicSearchResult,
  readLastPublicSearchResult,
  rememberLastOpenedPublicSearchResult,
} from "./recentPublicSearch";

const valid = {
  type: "activity",
  title: "  Детский спектакль  ",
  url: "/minsk/events/show?date=2026-11-02",
  query: "  театр    детский ",
};
assert.deepEqual(parseLastPublicSearchResult(JSON.stringify(valid)), {
  ...valid,
  title: "Детский спектакль",
  query: "театр детский",
});
assert.equal(parseLastPublicSearchResult(null), null);
assert.equal(parseLastPublicSearchResult("not-json"), null);
assert.equal(parseLastPublicSearchResult(JSON.stringify({ ...valid, title: "" })), null);
assert.equal(parseLastPublicSearchResult(JSON.stringify({ ...valid, url: "//example.org/phish" })), null);
assert.equal(parseLastPublicSearchResult(JSON.stringify({ ...valid, url: "/\\example.com" })), null);
assert.equal(parseLastPublicSearchResult(JSON.stringify({ ...valid, url: "javascript:alert(1)" })), null);
assert.equal(parseLastPublicSearchResult(JSON.stringify({ ...valid, type: "unsupported" })), null);

const local = new Map<string, string>();
const events: string[] = [];
const browser = {
  localStorage: {
    getItem: (key: string) => local.get(key) ?? null,
    setItem: (key: string, value: string) => { local.set(key, value); },
  },
  dispatchEvent: (event: Event) => { events.push(event.type); return true; },
};
const previousWindow = (globalThis as { window?: unknown }).window;
const previousEvent = (globalThis as { Event?: unknown }).Event;
(globalThis as { window?: unknown }).window = browser;
(globalThis as { Event?: unknown }).Event = class { constructor(public type: string) {} };
try {
  assert.equal(readLastPublicSearchResult(), null);
  rememberLastOpenedPublicSearchResult(
    { type: "activity", title: "Первый спектакль", url: "/minsk/events/one" },
    "театр",
  );
  assert.equal(readLastPublicSearchResult()?.title, "Первый спектакль");
  rememberLastOpenedPublicSearchResult(
    { type: "place", title: "Детский центр", url: "/minsk/places/two" },
    "центр",
  );
  const saved = readLastPublicSearchResult();
  assert.equal(saved?.title, "Детский центр");
  assert.equal(saved?.type, "place");
  assert.equal(saved?.url, "/minsk/places/two");
  assert.equal(saved?.query, "центр");
  assert.equal(local.get("mmg.publicSearch.lastQuery"), "центр");
  // An invalid/unfinished navigation never erases the last meaningful result.
  rememberLastOpenedPublicSearchResult(
    { type: "activity", title: "Invalid", url: "https://example.com" },
    "тест",
  );
  assert.equal(readLastPublicSearchResult()?.title, "Детский центр");
  assert.ok(events.includes("mmg-last-search-result-updated"));
} finally {
  (globalThis as { window?: unknown }).window = previousWindow;
  (globalThis as { Event?: unknown }).Event = previousEvent;
}
console.log("Last opened public search result: OK");
