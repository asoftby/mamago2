import assert from "node:assert/strict";
import test from "node:test";
import {
  FAMILY_PICKS_PLACEMENT,
  familyPickAnalyticsMeta,
  familyPicksSubtitle,
  familyPicksTitle,
  otherIdeasHref,
  shouldInviteToProfile,
} from "./familyPicksView";

test("subtitle follows the show window", () => {
  assert.equal(familyPicksSubtitle("WEEKEND"), "На эти выходные");
  assert.equal(familyPicksSubtitle("WEEK"), "На этой неделе");
});

test("guest always sees «Популярно в …»; users see the server level title; NONE hides the block", () => {
  const base = { cityLocative: "в Минске" };
  assert.equal(familyPicksTitle({ ...base, audience: "guest", level: "POPULAR", serverTitle: "Популярное на выходных" }), "Популярно в Минске");
  assert.equal(familyPicksTitle({ ...base, audience: "user", level: "PERSONAL", serverTitle: "Для вашей семьи" }), "Для вашей семьи");
  assert.equal(familyPicksTitle({ ...base, audience: "user", level: "AGE", serverTitle: "По возрасту ваших детей" }), "По возрасту ваших детей");
  assert.equal(familyPicksTitle({ ...base, audience: "user", level: "NONE", serverTitle: null }), null);
  assert.equal(familyPicksTitle({ ...base, audience: "guest", level: "NONE", serverTitle: null }), null);
});

test("profile invite only for the non-personal fallback", () => {
  assert.equal(shouldInviteToProfile("POPULAR"), true);
  assert.equal(shouldInviteToProfile("PERSONAL"), false);
  assert.equal(shouldInviteToProfile("AGE"), false);
});

test("«Другие идеи» links to the city events page with the children's age filter", () => {
  assert.equal(otherIdeasHref({ citySlug: "minsk", ageFilter: ["3-5", "6-8"], mode: "WEEKEND" }), "/minsk/events?age=3-5%2C6-8");
  assert.equal(otherIdeasHref({ citySlug: "minsk", ageFilter: [], mode: "WEEK" }), "/minsk/events");
});

test("analytics meta carries placement, personalization level, reason codes and exposure ids", () => {
  const meta = familyPickAnalyticsMeta({
    level: "PERSONAL",
    runId: "run1",
    item: { exposureId: "exp1", position: 2, reasonCodes: ["AGE_MATCH", "FREE"] },
  });
  assert.equal(meta.placement, FAMILY_PICKS_PLACEMENT);
  assert.equal(meta.placement, "HOME_FOR_FAMILY");
  assert.equal(meta.personalizationLevel, "PERSONAL");
  assert.deepEqual(meta.reasonCodes, ["AGE_MATCH", "FREE"]);
  assert.equal(meta.source, "recommendation");
  assert.equal(meta.recommendationExposureId, "exp1");
  assert.equal(meta.recommendationRunId, "run1");
  assert.equal(meta.recommendationSurface, "home");
  const noTrace = familyPickAnalyticsMeta({ level: "POPULAR", runId: null, item: { exposureId: null, position: 1, reasonCodes: [] } });
  assert.ok(!("recommendationExposureId" in noTrace));
});
