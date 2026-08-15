import assert from "node:assert/strict";

import {
  OWNER_EXCLUDED_LEGACY_EVENT_IDS,
  OWNER_EXCLUDED_LEGACY_OFFER_IDS,
  isOwnerExcludedLegacyEventSourceRecordKey,
  isOwnerExcludedLegacyOfferSourceRecordKey,
} from "./policies";

function main() {
  assert.equal(OWNER_EXCLUDED_LEGACY_OFFER_IDS.length, 28, "exactly 28 owner-approved legacy Offer IDs");
  assert.equal(
    new Set(OWNER_EXCLUDED_LEGACY_OFFER_IDS).size,
    28,
    "no duplicate legacy Offer IDs in the exclusion list",
  );

  // Every one of the 28, in both possible Offer source post types.
  for (const id of OWNER_EXCLUDED_LEGACY_OFFER_IDS) {
    assert.equal(
      isOwnerExcludedLegacyOfferSourceRecordKey(`wordpress-db:hb-programs:${id}`),
      true,
      `hb-programs:${id} must be excluded`,
    );
    assert.equal(
      isOwnerExcludedLegacyOfferSourceRecordKey(`wordpress-db:services:${id}`),
      true,
      `services:${id} must be excluded`,
    );
  }

  // A valid, non-excluded Offer must never match.
  assert.equal(isOwnerExcludedLegacyOfferSourceRecordKey("wordpress-db:hb-programs:18932"), false);
  assert.equal(isOwnerExcludedLegacyOfferSourceRecordKey("wordpress-db:services:18932"), false);

  // Never matches by fuzzy substring/prefix — exact numeric ID only.
  assert.equal(isOwnerExcludedLegacyOfferSourceRecordKey("wordpress-db:hb-programs:422370"), false);
  assert.equal(isOwnerExcludedLegacyOfferSourceRecordKey("wordpress-db:hb-programs:142237"), false);

  // Never matches a non-Offer source-record-key, even with a numerically
  // colliding ID — this is Offer-scoped only.
  assert.equal(isOwnerExcludedLegacyOfferSourceRecordKey("wordpress-db:places:42237"), false);
  assert.equal(isOwnerExcludedLegacyOfferSourceRecordKey("wordpress-db:events:6147"), false);
  assert.equal(isOwnerExcludedLegacyOfferSourceRecordKey("wordpress-db:post:42237"), false);

  // Malformed keys never throw, never match.
  assert.equal(isOwnerExcludedLegacyOfferSourceRecordKey(""), false);
  assert.equal(isOwnerExcludedLegacyOfferSourceRecordKey("42237"), false);
  assert.equal(isOwnerExcludedLegacyOfferSourceRecordKey("wordpress-db:hb-programs:"), false);

  // Event 64586: exactly one owner-excluded legacy Event ID, and 64588
  // (which imports fine under the tolerant schedule fallback) must never be
  // excluded.
  assert.equal(OWNER_EXCLUDED_LEGACY_EVENT_IDS.length, 1, "exactly 1 owner-approved legacy Event ID");
  assert.deepEqual(OWNER_EXCLUDED_LEGACY_EVENT_IDS, [64586]);

  assert.equal(isOwnerExcludedLegacyEventSourceRecordKey("wordpress-db:events:64586"), true);
  assert.equal(isOwnerExcludedLegacyEventSourceRecordKey("wordpress-db:events:64588"), false, "64588 must never be excluded");

  // Never matches by fuzzy substring/prefix — exact numeric ID only.
  assert.equal(isOwnerExcludedLegacyEventSourceRecordKey("wordpress-db:events:645860"), false);
  assert.equal(isOwnerExcludedLegacyEventSourceRecordKey("wordpress-db:events:164586"), false);

  // Never matches a non-Event source-record-key, even with a numerically
  // colliding ID — this is Event-scoped only.
  assert.equal(isOwnerExcludedLegacyEventSourceRecordKey("wordpress-db:places:64586"), false);
  assert.equal(isOwnerExcludedLegacyEventSourceRecordKey("wordpress-db:hb-programs:64586"), false);
  assert.equal(isOwnerExcludedLegacyEventSourceRecordKey("wordpress-db:post:64586"), false);

  // Malformed keys never throw, never match.
  assert.equal(isOwnerExcludedLegacyEventSourceRecordKey(""), false);
  assert.equal(isOwnerExcludedLegacyEventSourceRecordKey("64586"), false);
  assert.equal(isOwnerExcludedLegacyEventSourceRecordKey("wordpress-db:events:"), false);
}

main();
console.log("migration policies tests: OK");
