import assert from "node:assert/strict";
import test from "node:test";
import {
  hasFullPublicReleaseScope,
  isDeferredPublicFeatureEnabled,
  isOfferTypeInPublicReleaseScope,
} from "./publicReleaseScope";

const features = [
  "classes",
  "birthday",
  "birthdayBuilder",
  "camps",
] as const;

const offerTypes = [
  "PLACE_VISIT",
  "ONE_TIME_ACTIVITY",
  "REGULAR_ACTIVITY",
  "CAMP",
  "PARTY_SERVICE",
  "PARTY_PACKAGE",
  null,
  undefined,
] as const;

test("explicit non-PROD environments retain full scope", () => {
  for (const APP_ENV of [
    "dev", "development", "local",
    "staging", "preview", "test", " DEV ",
  ]) {
    const env = { APP_ENV };
    assert.equal(hasFullPublicReleaseScope(env), true);

    for (const feature of features) {
      assert.equal(
        isDeferredPublicFeatureEnabled(feature, env),
        true,
      );
    }

    for (const type of offerTypes) {
      assert.equal(
        isOfferTypeInPublicReleaseScope(type, env),
        true,
      );
    }
  }
});

test("PROD and unknown environments fail closed", () => {
  for (const APP_ENV of [
    "production", "prod", "PROD",
    "", "unknown", undefined,
  ]) {
    const env = { APP_ENV };
    assert.equal(hasFullPublicReleaseScope(env), false);

    for (const feature of features) {
      assert.equal(
        isDeferredPublicFeatureEnabled(feature, env),
        false,
      );
    }

    for (const type of offerTypes) {
      assert.equal(
        isOfferTypeInPublicReleaseScope(type, env),
        type === "PLACE_VISIT",
      );
    }
  }
});
