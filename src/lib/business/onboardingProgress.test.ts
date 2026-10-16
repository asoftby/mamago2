import assert from "node:assert/strict";
import {
  buildBusinessOnboardingSnapshot,
  businessPublicPath,
  type BusinessOnboardingPublication,
} from "./onboardingProgress";

const EMPTY = { startedAt: null, tourCompletedAt: null, tourSkippedAt: null, firstPublicViewedAt: null };
const draft: BusinessOnboardingPublication = { kind: "place", id: "p1", title: "Студия", slug: null, status: "DRAFT" };
const pending: BusinessOnboardingPublication = { kind: "event", id: "e1", title: "Мастер-класс", slug: "event-1", status: "PENDING" };
const published: BusinessOnboardingPublication = { kind: "offer", id: "o1", title: "Занятие", slug: "offer-1", status: "PUBLISHED" };

assert.deepEqual(
  { show: buildBusinessOnboardingSnapshot([], null).showLaunchpad, done: buildBusinessOnboardingSnapshot([], null).done },
  { show: true, done: 1 },
  "empty approved business starts in launchpad",
);

const withDraft = buildBusinessOnboardingSnapshot([draft], EMPTY);
assert.equal(withDraft.showLaunchpad, true);
assert.equal(withDraft.draft?.id, "p1");
assert.equal(withDraft.done, 2);

const withPending = buildBusinessOnboardingSnapshot([pending], EMPTY);
assert.equal(withPending.pending?.id, "e1");
assert.equal(withPending.done, 2);

const existingBusiness = buildBusinessOnboardingSnapshot([published], null);
assert.equal(existingBusiness.showLaunchpad, false, "old active partners never forced into onboarding");
assert.equal(existingBusiness.done, 3);

const newBusinessPublished = buildBusinessOnboardingSnapshot([published], { ...EMPTY, startedAt: new Date().toISOString() });
assert.equal(newBusinessPublished.showLaunchpad, true, "new partner sees first-live success step");
assert.equal(newBusinessPublished.done, 3);
assert.equal(businessPublicPath(published), "/offers/offer-1");
assert.equal(businessPublicPath(draft), null);
assert.equal(businessPublicPath(pending), null);

const finished = buildBusinessOnboardingSnapshot([published], {
  ...EMPTY,
  startedAt: new Date().toISOString(),
  firstPublicViewedAt: new Date().toISOString(),
});
assert.equal(finished.showLaunchpad, false);
assert.equal(finished.done, 4);

const edited = buildBusinessOnboardingSnapshot([{ ...published, status: "PENDING_UPDATE" }], EMPTY);
assert.equal(edited.published?.id, "o1", "pending edits preserve live card");

console.log("business onboarding progress: PASS");
