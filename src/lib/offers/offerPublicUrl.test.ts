import assert from "node:assert/strict";

import { getOfferPublicPath, getOfferPublicSection, parseOfferPublicSection } from "./offerPublicUrl";

// Canonical path is section-free — /{city}/offers/{slug}. See
// docs/migration/seo/final-url-architecture-2026-08-15.md §3, BACKLOG-116.
assert.equal(getOfferPublicPath({ slug: "real-slug" }, "minsk"), "/minsk/offers/real-slug");
assert.equal(getOfferPublicPath({ slug: null }, "minsk"), "/minsk");

// Same slug in two different cities resolves independently — matches
// Offer.slug's per-city uniqueness (@@unique([cityId, slug])).
assert.equal(getOfferPublicPath({ slug: "summer-camp" }, "minsk"), "/minsk/offers/summer-camp");
assert.equal(getOfferPublicPath({ slug: "summer-camp" }, "gomel"), "/gomel/offers/summer-camp");
assert.notEqual(
  getOfferPublicPath({ slug: "summer-camp" }, "minsk"),
  getOfferPublicPath({ slug: "summer-camp" }, "gomel"),
);

// Section (a mutable taxonomy/filter concept — see getOfferPublicSection
// below) is never part of the canonical path, so it cannot be passed to
// getOfferPublicPath at all anymore — a compile-time guarantee, not just
// a runtime one. This test documents that guarantee is exercised: the
// canonical path stays identical no matter what a would-be "stale
// section" input would have been (CLASS vs SERVICE vs unknown legacy
// kind), because the path builder never looks at kind/duration/campType.
assert.equal(getOfferPublicPath({ slug: "class-offer" }, "minsk"), "/minsk/offers/class-offer");

// getOfferPublicSection is still a real, working taxonomy/filter helper —
// unaffected by the canonical-URL change, and used elsewhere for listing/
// category purposes, never for the detail canonical.
assert.equal(getOfferPublicSection({ kind: "CLASS", durationType: "single" }), "events");
assert.equal(getOfferPublicSection({ kind: "CLASS", durationType: "recurring" }), "programs");
assert.equal(getOfferPublicSection({ kind: "CLASS", campProgramType: "SUMMER" }), "camps");
assert.equal(getOfferPublicSection({ kind: "PARTY" }), "birthday");
assert.equal(getOfferPublicSection({ kind: "SERVICE" }), "programs");
assert.equal(getOfferPublicSection({ kind: "EVENT" }), "events");

// Changing an offer's section (kind/durationType/campProgramType) must
// never change its canonical URL — the two are fully decoupled now.
const sectionBefore = getOfferPublicSection({ kind: "CLASS", durationType: "single" });
const pathBefore = getOfferPublicPath({ slug: "stable-slug" }, "minsk");
const sectionAfter = getOfferPublicSection({ kind: "CLASS", campProgramType: "SUMMER" });
const pathAfter = getOfferPublicPath({ slug: "stable-slug" }, "minsk");
assert.notEqual(sectionBefore, sectionAfter, "sanity: section really did change");
assert.equal(pathBefore, pathAfter, "canonical path must be unaffected by a section change");

assert.equal(parseOfferPublicSection("camps"), "camps");
assert.equal(parseOfferPublicSection("not-a-real-section"), null);

console.log("offerPublicUrl tests: OK");
