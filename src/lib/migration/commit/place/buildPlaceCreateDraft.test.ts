import assert from "node:assert/strict";

import { buildPlaceCreateDraft } from "./buildPlaceCreateDraft";
import type { NormalizedPlaceCandidate, PlaceCommitContext } from "./types";

function candidateFixture(overrides: Partial<NormalizedPlaceCandidate> = {}): NormalizedPlaceCandidate {
  return {
    title: "Cool Place",
    slug: "cool-place",
    content: "<p>A cool place for kids.</p>",
    excerpt: "A cool place excerpt",
    status: "publish",
    publishedAt: "2026-01-01 00:00:00",
    modifiedAt: "2026-01-02 00:00:00",
    shortDescription: "A great place for kids",
    phone: "+375291234567",
    phoneE164: "+375291234567",
    openingHours: null,
    email: "hello@example.com",
    workHoursRaw: "Mon-Fri 9-18",
    locationRaw: "Minsk, some street",
    cityRaw: "Minsk",
    coordinates: { lat: 53.9, lng: 27.5667 },
    media: { thumbnailAttachmentId: 555, galleryAttachmentIds: [111, 222] },
    seo: { title: "SEO Title", focusKeyword: "kids playground" },
    sourceTerms: [{ termId: 20, taxonomy: "places_category", name: "Cafe", slug: "kids-cafe" }],
    rawMeta: {},
    ...overrides,
  };
}

function contextFixture(overrides: Partial<PlaceCommitContext> = {}): PlaceCommitContext {
  return {
    createdByUserId: "user-1",
    cityId: "city-1",
    // Manual editor choice — never derived from candidate.sourceTerms.
    category: "кафе",
    ...overrides,
  };
}

function testHappyPath() {
  const result = buildPlaceCreateDraft({ candidate: candidateFixture(), context: contextFixture() });

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.deepEqual(result.warnings, []);

  assert.equal(result.draft.title, "Cool Place");
  assert.equal(result.draft.shortDesc, "A great place for kids");
  assert.equal(result.draft.category, "кафе");
  assert.equal(result.draft.createdByUserId, "user-1");
  assert.equal(result.draft.cityId, "city-1");
  assert.equal(result.draft.lat, 53.9);
  assert.equal(result.draft.lng, 27.5667);
  assert.equal(result.draft.phone, "+375291234567");
}

/**
 * `draft.phone` must come from `candidate.phoneE164`, never the raw
 * `candidate.phone` evidence field — even when they differ (raw legacy
 * text vs. normalized E.164), the draft only ever sees the safe value.
 */
function testDraftPhoneComesFromPhoneE164NotRawPhone() {
  const result = buildPlaceCreateDraft({
    candidate: candidateFixture({ phone: "+375 (25) 530-00-53", phoneE164: "+375255300053" }),
    context: contextFixture(),
  });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.draft.phone, "+375255300053");
}

function testUnresolvablePhoneNeverWrittenAsGarbage() {
  const result = buildPlaceCreateDraft({
    candidate: candidateFixture({ phone: "not a phone at all", phoneE164: null }),
    context: contextFixture(),
  });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  // null, never the raw unparseable text.
  assert.equal(result.draft.phone, null);
}

function testOpeningHoursCarriedThroughVerbatimWhenPresent() {
  const openingHours: NormalizedPlaceCandidate["openingHours"] = {
    mode: "WEEKLY",
    timezone: "Europe/Minsk",
    rules: [
      { dayOfWeek: "MON", isOpen: true, allDay: false, intervals: [{ startTime: "09:00", endTime: "18:00" }] },
    ],
  };
  const result = buildPlaceCreateDraft({
    candidate: candidateFixture({ openingHours }),
    context: contextFixture(),
  });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.deepEqual(result.draft.openingHours, openingHours);
}

function testOpeningHoursOmittedFromDraftWhenCandidateHasNone() {
  const result = buildPlaceCreateDraft({
    candidate: candidateFixture({ openingHours: null }),
    context: contextFixture(),
  });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.ok(!("openingHours" in result.draft), "must never fabricate a schedule when none exists");
}

function testMissingCreatedByUserIdBlocks() {
  const result = buildPlaceCreateDraft({
    candidate: candidateFixture(),
    context: contextFixture({ createdByUserId: "" }),
  });

  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.ok(result.reasons.some((r) => r.code === "MISSING_CREATED_BY"));
}

function testMissingTitleBlocks() {
  const result = buildPlaceCreateDraft({
    candidate: candidateFixture({ title: "   " }),
    context: contextFixture(),
  });

  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.ok(result.reasons.some((r) => r.code === "MISSING_TITLE"));
}

function testShortDescFromShortDescription() {
  const result = buildPlaceCreateDraft({
    candidate: candidateFixture({ shortDescription: "Explicit short desc" }),
    context: contextFixture(),
  });

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.draft.shortDesc, "Explicit short desc");
}

function testShortDescFallsBackToExcerpt() {
  const result = buildPlaceCreateDraft({
    candidate: candidateFixture({ shortDescription: null, excerpt: "Fallback excerpt text" }),
    context: contextFixture(),
  });

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.draft.shortDesc, "Fallback excerpt text");
}

function testShortDescFallsBackToContentWithHtmlStrippedAndTruncated() {
  const longText = "A".repeat(250);
  const result = buildPlaceCreateDraft({
    candidate: candidateFixture({
      shortDescription: null,
      excerpt: "",
      content: `<p>${longText}</p><div>ignored</div>`,
    }),
    context: contextFixture(),
  });

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.ok(!result.draft.shortDesc.includes("<"), "HTML tags must be stripped");
  assert.ok(result.draft.shortDesc.length <= 200, "shortDesc must be truncated to 200 chars");
  assert.ok(result.draft.shortDesc.endsWith("…"), "truncated shortDesc must end with an ellipsis");
}

function testAllShortDescSourcesEmptyBlocks() {
  const result = buildPlaceCreateDraft({
    candidate: candidateFixture({ shortDescription: null, excerpt: "", content: "" }),
    context: contextFixture(),
  });

  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.ok(result.reasons.some((r) => r.code === "MISSING_SHORT_DESC"));
}

function testMissingCategoryCreatesDraftWithWarningEvenWithSourceTermsPresent() {
  // sourceTerms carry a places_category term that *looks* mappable — this
  // must not matter at all: category is a manual editor choice, and with
  // no context.category, the draft omits category regardless of sourceTerms.
  const result = buildPlaceCreateDraft({
    candidate: candidateFixture({
      sourceTerms: [{ termId: 20, taxonomy: "places_category", name: "Cafe", slug: "kids-cafe" }],
    }),
    context: contextFixture({ category: null }),
  });

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.ok(!("category" in result.draft));
  assert.ok(result.warnings.some((w) => w.code === "CATEGORY_MISSING_REQUIRES_REVIEW"));
}

function testEmptyContextCategoryCreatesDraftWithWarning() {
  const result = buildPlaceCreateDraft({
    candidate: candidateFixture(),
    context: contextFixture({ category: "   " }),
  });

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.ok(!("category" in result.draft));
  assert.ok(result.warnings.some((w) => w.code === "CATEGORY_MISSING_REQUIRES_REVIEW"));
}

function testSourceTermsDoNotInfluenceCategory() {
  // sourceTerms map to something completely different from context.category
  // ("Kids Cafe") — the draft must use context.category verbatim, proving
  // sourceTerms are never consulted for Place.category.
  const result = buildPlaceCreateDraft({
    candidate: candidateFixture({
      sourceTerms: [{ termId: 99, taxonomy: "places_category", name: "Kids Cafe", slug: "kids-cafe" }],
    }),
    context: contextFixture({ category: "ресторан" }),
  });

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.draft.category, "ресторан");
}

function testSlugAlwaysNull() {
  const result = buildPlaceCreateDraft({ candidate: candidateFixture(), context: contextFixture() });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.draft.slug, null);
}

function testStatusPendingAndLocationSourceManual() {
  const result = buildPlaceCreateDraft({ candidate: candidateFixture(), context: contextFixture() });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.draft.status, "PENDING");
  assert.equal(result.draft.locationSource, "MANUAL");
}

function testMediaLogoGalleryNeverInDraft() {
  const result = buildPlaceCreateDraft({ candidate: candidateFixture(), context: contextFixture() });
  assert.equal(result.ok, true);
  if (!result.ok) return;

  const draftKeys = Object.keys(result.draft);
  assert.ok(!draftKeys.includes("logoImageId"));
  assert.ok(!draftKeys.includes("media"));
  assert.ok(!draftKeys.includes("gallery"));
  assert.ok(!draftKeys.includes("ownerBusinessId"));
  assert.ok(!draftKeys.includes("email"), "Place has no email column — must never appear in the draft");
  assert.equal(result.draft.website, null);
}

function testCityIdOnlyFromContextNeverGuessedFromCityRaw() {
  const result = buildPlaceCreateDraft({
    candidate: candidateFixture({ cityRaw: "Some City That Does Not Exist" }),
    context: contextFixture({ cityId: "city-42" }),
  });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.draft.cityId, "city-42");

  const withoutCityContext = buildPlaceCreateDraft({
    candidate: candidateFixture({ cityRaw: "Minsk" }),
    context: contextFixture({ cityId: undefined }),
  });
  assert.equal(withoutCityContext.ok, true);
  if (!withoutCityContext.ok) return;
  assert.equal(withoutCityContext.draft.cityId, null, "must never derive cityId from cityRaw itself");
}

function main() {
  testHappyPath();
  testOpeningHoursCarriedThroughVerbatimWhenPresent();
  testOpeningHoursOmittedFromDraftWhenCandidateHasNone();
  testDraftPhoneComesFromPhoneE164NotRawPhone();
  testUnresolvablePhoneNeverWrittenAsGarbage();
  testMissingCreatedByUserIdBlocks();
  testMissingTitleBlocks();
  testShortDescFromShortDescription();
  testShortDescFallsBackToExcerpt();
  testShortDescFallsBackToContentWithHtmlStrippedAndTruncated();
  testAllShortDescSourcesEmptyBlocks();
  testMissingCategoryCreatesDraftWithWarningEvenWithSourceTermsPresent();
  testEmptyContextCategoryCreatesDraftWithWarning();
  testSourceTermsDoNotInfluenceCategory();
  testSlugAlwaysNull();
  testStatusPendingAndLocationSourceManual();
  testMediaLogoGalleryNeverInDraft();
  testCityIdOnlyFromContextNeverGuessedFromCityRaw();
}

main();
console.log("buildPlaceCreateDraft tests: OK");
