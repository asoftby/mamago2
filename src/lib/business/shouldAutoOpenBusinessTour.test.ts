import assert from "node:assert/strict";
import { shouldAutoOpenBusinessTour } from "./shouldAutoOpenBusinessTour";
import type { BusinessOnboardingSnapshot } from "./onboardingProgress";

const base: BusinessOnboardingSnapshot = {
  showLaunchpad: true,
  startedAt: null,
  tourCompleted: false,
  tourSkipped: false,
  viewedPublished: false,
  draft: null,
  pending: null,
  published: null,
  total: 4,
  done: 1,
  hasAny: false,
};

assert.equal(shouldAutoOpenBusinessTour(base), true, "first empty launchpad visit opens once");
assert.equal(
  shouldAutoOpenBusinessTour({ ...base, startedAt: new Date().toISOString() }),
  false,
  "startedAt blocks reopen",
);
assert.equal(
  shouldAutoOpenBusinessTour({ ...base, tourSkipped: true }),
  false,
  "tourSkipped blocks reopen",
);
assert.equal(
  shouldAutoOpenBusinessTour({ ...base, tourCompleted: true }),
  false,
  "tourCompleted blocks reopen",
);
assert.equal(
  shouldAutoOpenBusinessTour({ ...base, hasAny: true }),
  false,
  "existing publications skip auto-open",
);
assert.equal(
  shouldAutoOpenBusinessTour({ ...base, showLaunchpad: false }),
  false,
  "non-launchpad dashboard never auto-opens",
);

console.log("shouldAutoOpenBusinessTour: PASS");
