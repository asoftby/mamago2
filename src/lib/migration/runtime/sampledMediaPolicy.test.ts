import assert from "node:assert/strict";

import {
  DEFAULT_FULL_MEDIA_SOURCE_RECORD_KEYS,
  resolveSampledMediaPolicy,
  SKIPPED_BY_MEDIA_SAMPLE_POLICY_REASON,
} from "./sampledMediaPolicy";

const ALLOWLISTED_EVENT = "wordpress-db:events:42041";
const ALLOWLISTED_PLACE = "wordpress-db:places:5389";
const ALLOWLISTED_OFFER = "wordpress-db:hb-programs:15941";
const NOT_ALLOWLISTED_EVENT = "wordpress-db:events:99999";
const NOT_ALLOWLISTED_PLACE = "wordpress-db:places:99999";
const NOT_ALLOWLISTED_OFFER = "wordpress-db:hb-programs:99999";

// ---------------------------------------------------------------------------
// The 9-key config itself.
// ---------------------------------------------------------------------------

function testDefaultAllowlistHasExactlyNineKeysThreePerEntity() {
  assert.equal(DEFAULT_FULL_MEDIA_SOURCE_RECORD_KEYS.length, 9);
  const eventCount = DEFAULT_FULL_MEDIA_SOURCE_RECORD_KEYS.filter((k) => k.startsWith("wordpress-db:events:")).length;
  const placeCount = DEFAULT_FULL_MEDIA_SOURCE_RECORD_KEYS.filter((k) => k.startsWith("wordpress-db:places:")).length;
  const offerCount = DEFAULT_FULL_MEDIA_SOURCE_RECORD_KEYS.filter(
    (k) => k.startsWith("wordpress-db:hb-programs:") || k.startsWith("wordpress-db:services:"),
  ).length;
  assert.equal(eventCount, 3);
  assert.equal(placeCount, 3);
  assert.equal(offerCount, 3);
}

function testDefaultAllowlistHasNoDuplicates() {
  assert.equal(new Set(DEFAULT_FULL_MEDIA_SOURCE_RECORD_KEYS).size, DEFAULT_FULL_MEDIA_SOURCE_RECORD_KEYS.length);
}

// ---------------------------------------------------------------------------
// LOCAL — allowlisted vs non-allowlisted, per entity type.
// ---------------------------------------------------------------------------

function testLocalAllowlistedEventGetsFull() {
  const result = resolveSampledMediaPolicy({ environment: "LOCAL", sourceRecordKey: ALLOWLISTED_EVENT });
  assert.equal(result.policy.name, "FULL");
  assert.equal(result.reason, undefined);
}

function testLocalNonAllowlistedEventGetsMetadata() {
  const result = resolveSampledMediaPolicy({ environment: "LOCAL", sourceRecordKey: NOT_ALLOWLISTED_EVENT });
  assert.equal(result.policy.name, "METADATA");
  assert.equal(result.reason, SKIPPED_BY_MEDIA_SAMPLE_POLICY_REASON);
}

function testLocalAllowlistedPlaceGetsFull() {
  const result = resolveSampledMediaPolicy({ environment: "LOCAL", sourceRecordKey: ALLOWLISTED_PLACE });
  assert.equal(result.policy.name, "FULL");
}

function testLocalNonAllowlistedPlaceGetsMetadata() {
  const result = resolveSampledMediaPolicy({ environment: "LOCAL", sourceRecordKey: NOT_ALLOWLISTED_PLACE });
  assert.equal(result.policy.name, "METADATA");
  assert.equal(result.reason, SKIPPED_BY_MEDIA_SAMPLE_POLICY_REASON);
}

function testLocalAllowlistedOfferGetsFull() {
  const result = resolveSampledMediaPolicy({ environment: "LOCAL", sourceRecordKey: ALLOWLISTED_OFFER });
  assert.equal(result.policy.name, "FULL");
}

function testLocalNonAllowlistedOfferGetsMetadata() {
  const result = resolveSampledMediaPolicy({ environment: "LOCAL", sourceRecordKey: NOT_ALLOWLISTED_OFFER });
  assert.equal(result.policy.name, "METADATA");
}

// ---------------------------------------------------------------------------
// DEV — same behavior as LOCAL.
// ---------------------------------------------------------------------------

function testDevAllowlistedEventGetsFull() {
  const result = resolveSampledMediaPolicy({ environment: "DEV", sourceRecordKey: ALLOWLISTED_EVENT });
  assert.equal(result.policy.name, "FULL");
}

function testDevNonAllowlistedEventGetsMetadata() {
  const result = resolveSampledMediaPolicy({ environment: "DEV", sourceRecordKey: NOT_ALLOWLISTED_EVENT });
  assert.equal(result.policy.name, "METADATA");
}

function testDevAllowlistedPlaceGetsFull() {
  const result = resolveSampledMediaPolicy({ environment: "DEV", sourceRecordKey: ALLOWLISTED_PLACE });
  assert.equal(result.policy.name, "FULL");
}

function testDevNonAllowlistedPlaceGetsMetadata() {
  const result = resolveSampledMediaPolicy({ environment: "DEV", sourceRecordKey: NOT_ALLOWLISTED_PLACE });
  assert.equal(result.policy.name, "METADATA");
}

function testDevAllowlistedOfferGetsFull() {
  const result = resolveSampledMediaPolicy({ environment: "DEV", sourceRecordKey: ALLOWLISTED_OFFER });
  assert.equal(result.policy.name, "FULL");
}

function testDevNonAllowlistedOfferGetsMetadata() {
  const result = resolveSampledMediaPolicy({ environment: "DEV", sourceRecordKey: NOT_ALLOWLISTED_OFFER });
  assert.equal(result.policy.name, "METADATA");
}

// ---------------------------------------------------------------------------
// PRODUCTION — always FULL, allowlist has zero effect.
// ---------------------------------------------------------------------------

function testProdEventAlwaysFullRegardlessOfAllowlist() {
  const result = resolveSampledMediaPolicy({ environment: "PROD", sourceRecordKey: NOT_ALLOWLISTED_EVENT });
  assert.equal(result.policy.name, "FULL");
  assert.equal(result.reason, undefined);
}

function testProdPlaceAlwaysFullRegardlessOfAllowlist() {
  const result = resolveSampledMediaPolicy({ environment: "PROD", sourceRecordKey: NOT_ALLOWLISTED_PLACE });
  assert.equal(result.policy.name, "FULL");
}

function testProdOfferAlwaysFullRegardlessOfAllowlist() {
  const result = resolveSampledMediaPolicy({ environment: "PROD", sourceRecordKey: NOT_ALLOWLISTED_OFFER });
  assert.equal(result.policy.name, "FULL");
}

/** A dev-local allowlist must never be able to *restrict* production — passing one explicitly still changes nothing for PROD. */
function testProdCannotBeRestrictedByADevAllowlist() {
  const result = resolveSampledMediaPolicy({
    environment: "PROD",
    sourceRecordKey: NOT_ALLOWLISTED_EVENT,
    fullMediaSourceRecordKeys: [ALLOWLISTED_EVENT], // deliberately excludes NOT_ALLOWLISTED_EVENT
  });
  assert.equal(result.policy.name, "FULL");
}

// ---------------------------------------------------------------------------
// Fail-closed behavior.
// ---------------------------------------------------------------------------

function testEmptyAllowlistFailsClosedToMetadataInLocal() {
  const result = resolveSampledMediaPolicy({
    environment: "LOCAL",
    sourceRecordKey: ALLOWLISTED_EVENT,
    fullMediaSourceRecordKeys: [],
  });
  assert.equal(result.policy.name, "METADATA", "empty allowlist must never silently fall back to FULL");
  assert.equal(result.reason, SKIPPED_BY_MEDIA_SAMPLE_POLICY_REASON);
}

function testMalformedAllowlistFailsClosedToMetadata() {
  const result = resolveSampledMediaPolicy({
    environment: "DEV",
    sourceRecordKey: ALLOWLISTED_EVENT,
    fullMediaSourceRecordKeys: "not-an-array" as unknown as readonly string[],
  });
  assert.equal(result.policy.name, "METADATA");
}

function testAllowlistWithNonStringEntriesFailsClosed() {
  const result = resolveSampledMediaPolicy({
    environment: "LOCAL",
    sourceRecordKey: ALLOWLISTED_EVENT,
    fullMediaSourceRecordKeys: [42, null] as unknown as readonly string[],
  });
  assert.equal(result.policy.name, "METADATA");
}

function testUnknownEnvironmentFailsClosedNeverFull() {
  const result = resolveSampledMediaPolicy({
    environment: "STAGING_TYPO" as unknown as "LOCAL",
    sourceRecordKey: ALLOWLISTED_EVENT,
  });
  assert.equal(result.policy.name, "METADATA");
  assert.equal(result.reason, SKIPPED_BY_MEDIA_SAMPLE_POLICY_REASON);
}

// ---------------------------------------------------------------------------
// Wrong entity / malformed keys never get FULL just by coincidence.
// ---------------------------------------------------------------------------

function testWrongEntityPrefixWithSameNumericIdNeverGetsFull() {
  // "42041" is an allowlisted Event id — a Place or Offer with the same
  // numeric id must not accidentally match.
  const asPlace = resolveSampledMediaPolicy({ environment: "LOCAL", sourceRecordKey: "wordpress-db:places:42041" });
  const asOffer = resolveSampledMediaPolicy({
    environment: "LOCAL",
    sourceRecordKey: "wordpress-db:hb-programs:42041",
  });
  assert.equal(asPlace.policy.name, "METADATA");
  assert.equal(asOffer.policy.name, "METADATA");
}

function testMalformedSourceRecordKeyNeverGetsFull() {
  const result = resolveSampledMediaPolicy({ environment: "LOCAL", sourceRecordKey: "not-a-real-key" });
  assert.equal(result.policy.name, "METADATA");
}

// ---------------------------------------------------------------------------
// Determinism.
// ---------------------------------------------------------------------------

function testDeterministicRepeatedResolution() {
  const first = resolveSampledMediaPolicy({ environment: "DEV", sourceRecordKey: ALLOWLISTED_PLACE });
  const second = resolveSampledMediaPolicy({ environment: "DEV", sourceRecordKey: ALLOWLISTED_PLACE });
  assert.deepEqual(first, second);
}

function main() {
  testDefaultAllowlistHasExactlyNineKeysThreePerEntity();
  testDefaultAllowlistHasNoDuplicates();

  testLocalAllowlistedEventGetsFull();
  testLocalNonAllowlistedEventGetsMetadata();
  testLocalAllowlistedPlaceGetsFull();
  testLocalNonAllowlistedPlaceGetsMetadata();
  testLocalAllowlistedOfferGetsFull();
  testLocalNonAllowlistedOfferGetsMetadata();

  testDevAllowlistedEventGetsFull();
  testDevNonAllowlistedEventGetsMetadata();
  testDevAllowlistedPlaceGetsFull();
  testDevNonAllowlistedPlaceGetsMetadata();
  testDevAllowlistedOfferGetsFull();
  testDevNonAllowlistedOfferGetsMetadata();

  testProdEventAlwaysFullRegardlessOfAllowlist();
  testProdPlaceAlwaysFullRegardlessOfAllowlist();
  testProdOfferAlwaysFullRegardlessOfAllowlist();
  testProdCannotBeRestrictedByADevAllowlist();

  testEmptyAllowlistFailsClosedToMetadataInLocal();
  testMalformedAllowlistFailsClosedToMetadata();
  testAllowlistWithNonStringEntriesFailsClosed();
  testUnknownEnvironmentFailsClosedNeverFull();

  testWrongEntityPrefixWithSameNumericIdNeverGetsFull();
  testMalformedSourceRecordKeyNeverGetsFull();

  testDeterministicRepeatedResolution();

  console.log("sampledMediaPolicy tests: OK");
}

main();
