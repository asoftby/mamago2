import assert from "node:assert/strict";

import { buildRouteCreateDraft, htmlToPlainText } from "./buildRouteCreateDraft";
import type { NormalizedRouteCandidate, RouteCommitContext } from "./buildRouteCreateDraft";

function candidateFixture(overrides: Partial<NormalizedRouteCandidate> = {}): NormalizedRouteCandidate {
  return {
    title: "Family Route",
    slug: "family-route",
    status: "publish",
    publishedAt: "2026-01-01 00:00:00",
    modifiedAt: "2026-01-02 00:00:00",
    stops: [
      { index: 2, title: "Second", description: "Second note", imageAttachmentIds: [202], placeId: null },
      { index: 1, title: "First", description: "First note", imageAttachmentIds: [101], placeId: null },
    ],
    locationRaw: '{"address":"Minsk"}',
    location: { address: "Minsk", latitude: null, longitude: null },
    media: { featuredAttachmentId: 900 },
    seo: { title: "SEO Route", focusKeyword: "route" },
    sourceTerms: [],
    rawMeta: {},
    ...overrides,
  };
}

function contextFixture(overrides: Partial<RouteCommitContext> = {}): RouteCommitContext {
  return { cityId: "city-1", ...overrides };
}

function testBuildsDraftWithPrivateDraftNoAuthor() {
  const result = buildRouteCreateDraft({
    candidate: candidateFixture(),
    context: contextFixture(),
    sourceRecordKey: "wordpress-db:routes:701",
  });

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.draft.status, "DRAFT");
  assert.equal(result.draft.visibility, "PRIVATE");
  assert.equal(result.draft.authorId, null);
  assert.equal(result.draft.cityId, "city-1");
  assert.equal(result.draft.seoTitle, "SEO Route");
  assert.ok(!("location" in result.draft));
  assert.ok(!("locationRaw" in result.draft));
}

function testStopsAreOrderedAndMappedWithoutMedia() {
  const result = buildRouteCreateDraft({ candidate: candidateFixture(), context: contextFixture() });

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.deepEqual(result.draft.stops, [
    { order: 1, placeId: null, customTitle: "First", note: "First note" },
    { order: 2, placeId: null, customTitle: "Second", note: "Second note" },
  ]);
  assert.ok(!("imageAttachmentIds" in result.draft.stops[0]));
  assert.ok(!("photoUrl" in result.draft.stops[0]));
}

function testMissingCityLeavesNullAndWarns() {
  const result = buildRouteCreateDraft({
    candidate: candidateFixture(),
    context: {},
    sourceRecordKey: "wordpress-db:routes:701",
  });

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.draft.cityId, null);
  const cityWarning = result.warnings.find((warning) => warning.code === "ROUTE_CITY_UNRESOLVED");
  assert(cityWarning);
  assert.equal(cityWarning.sourceRecordKey, "wordpress-db:routes:701");
}

function testRouteLevelLocationIsDroppedWithInformationalWarning() {
  const withLocation = buildRouteCreateDraft({ candidate: candidateFixture(), context: contextFixture(), sourceRecordKey: "wordpress-db:routes:701" });
  assert(withLocation.ok);
  assert(withLocation.warnings.some((warning) => warning.code === "ROUTE_LEVEL_LOCATION_DROPPED" && warning.severity === "INFO"));
  assert(!("location" in withLocation.draft));
  assert(!("locationRaw" in withLocation.draft));
  assert(withLocation.draft.stops.every((stop) => !("location" in stop) && !("locationRaw" in stop)));

  const empty = buildRouteCreateDraft({ candidate: candidateFixture({ locationRaw: "", location: null }), context: contextFixture() });
  assert(empty.ok);
  assert(!empty.warnings.some((warning) => warning.code === "ROUTE_LEVEL_LOCATION_DROPPED"));
}

function testBlocksMissingRequiredFields() {
  const result = buildRouteCreateDraft({
    candidate: candidateFixture({ title: " ", slug: "", stops: [] }),
    context: contextFixture(),
  });

  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.deepEqual(
    result.reasons.map((reason) => reason.code),
    ["MISSING_TITLE", "MISSING_SLUG", "MISSING_STOPS"],
  );
}

function testHtmlToPlainTextParagraphsAndBreaksBecomeNewlines() {
  assert.equal(
    htmlToPlainText("<p>First paragraph.</p><p>Second paragraph.</p>"),
    "First paragraph.\nSecond paragraph.",
  );
  assert.equal(htmlToPlainText("Line one<br>Line two<br/>Line three"), "Line one\nLine two\nLine three");
}

function testHtmlToPlainTextStripsNestedAndInlineTags() {
  // Every tag (opening or closing) becomes a literal space, not an empty
  // string — a closing inline tag right before punctuation therefore
  // leaves a stray space (e.g. "more ."), which is the real, existing
  // behavior of this function, not something this test changes.
  assert.equal(
    htmlToPlainText('<p>Visit <a href="https://example.com">our site</a> for <strong>more</strong>.</p>'),
    "Visit our site for more .",
  );
  assert.equal(htmlToPlainText("<div><ul><li>One</li><li>Two</li></ul></div>"), "One\nTwo");
}

function testHtmlToPlainTextDecodesEntities() {
  assert.equal(htmlToPlainText("Cafe&nbsp;&amp;&nbsp;Bar"), "Cafe & Bar");
  assert.equal(htmlToPlainText("&laquo;Quoted&raquo;"), "«Quoted»");
  assert.equal(htmlToPlainText("A&mdash;B&ndash;C"), "A—B–C");
  assert.equal(htmlToPlainText("Wait&hellip;"), "Wait…");
  assert.equal(htmlToPlainText("5 &quot;items&quot;"), '5 "items"');
}

function testHtmlToPlainTextCollapsesExcessBlankLines() {
  assert.equal(
    htmlToPlainText("<p>First</p><p></p><p></p><p>Second</p>"),
    "First\n\nSecond",
  );
}

function testHtmlToPlainTextIsIdempotentOnPlainText() {
  const plain = "Already plain text.\nSecond line with «quotes» and — a dash.";
  assert.equal(htmlToPlainText(plain), plain);
  assert.equal(htmlToPlainText(htmlToPlainText(plain)), htmlToPlainText(plain));
}

function main() {
  testBuildsDraftWithPrivateDraftNoAuthor();
  testStopsAreOrderedAndMappedWithoutMedia();
  testMissingCityLeavesNullAndWarns();
  testRouteLevelLocationIsDroppedWithInformationalWarning();
  testBlocksMissingRequiredFields();
  testHtmlToPlainTextParagraphsAndBreaksBecomeNewlines();
  testHtmlToPlainTextStripsNestedAndInlineTags();
  testHtmlToPlainTextDecodesEntities();
  testHtmlToPlainTextCollapsesExcessBlankLines();
  testHtmlToPlainTextIsIdempotentOnPlainText();
}

main();
console.log("buildRouteCreateDraft tests: OK");
