import assert from "node:assert/strict";
import { buildEventPayload, mapEventToFormData, type ActivityWithRelations } from "./mappers";
import { getDefaultFormData } from "./defaults";

{
  const form = mapEventToFormData({
    id: "event-1",
    title: "Legacy age event",
    description: null,
    ageLabel: "от 0 лет",
    ageMinMonths: 36,
    ageMaxMonths: 60,
    ageTags: [],
    agePolicy: "SPECIFIC",
    scheduleJson: {
      ageDetection: {
        raw: "от 0 лет",
        confidence: "high",
        suggestedBuckets: ["0-1", "1-3"],
        normalizedLabel: "от 0 лет",
        parsedMinAge: 0,
        parsedMaxAge: null,
      },
      ageDetectionAutoApplied: true,
    },
    coverImageId: null,
    placeId: null,
    eventCategoryId: null,
    priceFrom: null,
    priceTo: null,
    priceText: null,
    format: "OFFLINE",
    scheduleMode: "MULTI_DATE",
    shortDesc: "",
    status: "DRAFT",
    ownerUserId: "user-1",
    type: "EVENT",
  } as unknown as ActivityWithRelations);

  assert.deepEqual(form.ageRangeIds, ["3-5"]);
  assert.deepEqual(form.ageTags, ["3-5"]);
  assert.equal(form.ageDetectionUserOverride, true);
  assert.equal(form.ageDetectionAutoApplied, false);
}

{
  const form = getDefaultFormData();
  form.title = "Event";
  form.ageRangeIds = ["3-5"];
  form.ageTags = ["3-5"];
  form.agePolicy = "SPECIFIC";

  const payload = buildEventPayload(form);

  assert.equal(payload.ageMinMonths, 36);
  assert.equal(payload.ageMaxMonths, 60);
  assert.equal(payload.ageLabel, "3–5 лет");
  assert.deepEqual(payload.ageTags, ["3-5"]);
  assert.equal(payload.agePolicy, "SPECIFIC");
}

{
  const form = getDefaultFormData();
  form.title = "Any age event";
  form.agePolicy = "UNRESTRICTED";
  const payload = buildEventPayload(form);
  assert.equal(payload.agePolicy, "UNRESTRICTED");
  assert.deepEqual(payload.ageTags, []);
  assert.equal(payload.ageMinMonths, null);
  assert.equal(payload.ageMaxMonths, null);
}

{
  const form = getDefaultFormData();
  form.title = "Strict adult event";
  form.agePolicy = "ADULT_ONLY";
  const payload = buildEventPayload(form);
  assert.equal(payload.agePolicy, "ADULT_ONLY");
  assert.deepEqual(payload.ageTags, []);
}

{
  const legacyForm = mapEventToFormData({
    id: "legacy-scheduling",
    title: "Legacy scheduling",
    schedulingKind: null,
    scheduleJson: null,
  } as unknown as ActivityWithRelations);
  assert.equal(legacyForm.schedulingKind, null, "legacy Activity opens without a forced default");

  legacyForm.schedulingKind = "SLOT";
  assert.equal(buildEventPayload(legacyForm).schedulingKind, "SLOT");

  legacyForm.schedulingKind = "WINDOW";
  assert.equal(buildEventPayload(legacyForm).schedulingKind, "WINDOW");
}

console.log("event mappers tests: OK");
