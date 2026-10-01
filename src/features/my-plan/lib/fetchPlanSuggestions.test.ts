import assert from "node:assert/strict";
import test from "node:test";
import {
  buildPlanSuggestionsUrl,
  createPlanSuggestionAudienceSnapshot,
  fetchPlanSuggestions,
} from "./fetchPlanSuggestions";

test("profile audience keeps adult and child ids in the request URL", async () => {
  const snapshot = createPlanSuggestionAudienceSnapshot(["3-5"], ["user-u", "child-c"]);
  assert.deepEqual(snapshot, {
    ageRangeValues: ["3-5"],
    personaIds: ["user-u", "child-c"],
  });
  const url = buildPlanSuggestionsUrl({
    citySlug: "minsk",
    date: "2026-10-01",
    excludeActivityIds: [],
    ...snapshot,
  });
  assert.match(url, /ageRanges=3-5/);
  assert.match(url, /personaIds=user-u%2Cchild-c/);

  let requestedUrl = "";
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (input: string | URL | Request) => {
    requestedUrl = String(input);
    return new Response(JSON.stringify({ suggestions: [] }), { status: 200 });
  }) as typeof fetch;
  try {
    await fetchPlanSuggestions({
      citySlug: "minsk",
      date: "2026-10-01",
      excludeActivityIds: [],
      ...snapshot,
    });
    assert.equal(requestedUrl, url);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("manual needs-age and free-search snapshots never synthesize persona ids", () => {
  const manual = createPlanSuggestionAudienceSnapshot(["5-7"], []);
  assert.deepEqual(manual.personaIds, []);
  assert.doesNotMatch(buildPlanSuggestionsUrl({
    citySlug: "minsk",
    date: "2026-10-01",
    excludeActivityIds: [],
    ...manual,
  }), /personaIds=/);
  assert.deepEqual(createPlanSuggestionAudienceSnapshot([], []), {
    ageRangeValues: [],
    personaIds: [],
  });
});

test("snapshot dedupes both halves without mixing them", () => {
  assert.deepEqual(
    createPlanSuggestionAudienceSnapshot(["3-5", "3-5"], ["u", "c", "c"]),
    { ageRangeValues: ["3-5"], personaIds: ["u", "c"] },
  );
});
