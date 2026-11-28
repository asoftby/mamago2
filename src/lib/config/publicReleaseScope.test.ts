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

test("PROD feature flags keep PLACE_VISIT public while enabling only matching offers", () => {
  const classes = { APP_ENV: "production", ENABLE_PUBLIC_CLASSES: "true" };
  const birthday = { APP_ENV: "production", ENABLE_PUBLIC_BIRTHDAY: "true" };
  assert.equal(isDeferredPublicFeatureEnabled("classes", classes), true);
  assert.equal(isDeferredPublicFeatureEnabled("camps", classes), true);
  assert.equal(isOfferTypeInPublicReleaseScope("PLACE_VISIT", classes), true);
  for (const productType of ["ONE_TIME_ACTIVITY", "REGULAR_ACTIVITY", "CAMP"]) {
    assert.equal(isOfferTypeInPublicReleaseScope(productType, classes), true, productType);
    assert.equal(isOfferTypeInPublicReleaseScope(productType, birthday), false, productType);
  }
  assert.equal(isOfferTypeInPublicReleaseScope("PARTY_PACKAGE", classes), false);
  assert.equal(isDeferredPublicFeatureEnabled("birthday", birthday), true);
  assert.equal(isOfferTypeInPublicReleaseScope("PARTY_SERVICE", birthday), true);
  assert.equal(isOfferTypeInPublicReleaseScope("PARTY_PACKAGE", birthday), true);
  assert.equal(isOfferTypeInPublicReleaseScope(null, classes), false);
});
