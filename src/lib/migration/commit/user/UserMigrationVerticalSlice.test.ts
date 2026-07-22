import assert from "node:assert/strict";
import test from "node:test";

import {
  buildUserCanonicalHash,
  buildUserDraft,
  normalizeUserCandidate,
  normalizeUserEmail,
  validateUserDraft,
  type UserSourceCandidate,
} from "./UserMigrationVerticalSlice";

function source(overrides: Partial<UserSourceCandidate> = {}): UserSourceCandidate {
  return {
    sourceRecordKey: "wordpress-db:user:7", sourceSystem: "wordpress-db", legacyUserId: 7,
    email: " User@Example.COM ", displayName: "Safe Name", firstName: null, lastName: null, phone: null,
    sourceCreatedAt: "2020-01-01 00:00:00", legacyRoles: ["custom"], legacyPasswordPresent: false,
    businessLinked: false, businessEvidence: { exactOwnership: false, placeCount: 0 }, privilegedCollision: false,
    profileMediaReferencePresent: false, sourceHash: "raw-source-hash", ...overrides,
  };
}

test("email normalization trims, lowercases and preserves plus addressing", () => {
  assert.equal(normalizeUserEmail(" Test+tag@EXAMPLE.com "), "test+tag@example.com");
  assert.equal(normalizeUserEmail("broken"), null);
});

test("ordinary candidate produces least-privilege pending draft", () => {
  const candidate = normalizeUserCandidate(source());
  const draft = buildUserDraft(candidate);
  assert.deepEqual(draft, { email: "user@example.com", passwordHash: null, status: "PENDING_ACTIVATION", role: "USER", emailVerifiedAt: null, phoneE164: null, displayName: "Safe Name" });
  assert.deepEqual(validateUserDraft(candidate, draft), []);
  assert.equal("legacyPasswordPresent" in candidate, false);
});

test("business evidence is deferred and never elevates role", () => {
  const candidate = normalizeUserCandidate(source({ sourceRecordKey: "wordpress-db:user:38", legacyUserId: 38, businessLinked: true, businessEvidence: { exactOwnership: true, placeCount: 1 } }));
  assert.equal(candidate.classification, "BUSINESS_LINKED");
  assert.ok(candidate.warnings.includes("BUSINESS_OWNERSHIP_DEFERRED"));
  assert.equal(buildUserDraft(candidate)?.role, "USER");
});

test("privileged collision is blocking and has no create draft", () => {
  const candidate = normalizeUserCandidate(source({ sourceRecordKey: "wordpress-db:user:1", legacyUserId: 1, privilegedCollision: true, legacyRoles: ["administrator"] }));
  assert.equal(buildUserDraft(candidate), null);
  assert.deepEqual(validateUserDraft(candidate, null), ["PRIVILEGED_ACCOUNT_COLLISION"]);
});

test("missing name warns but does not block valid identity", () => {
  const candidate = normalizeUserCandidate(source({ displayName: null, firstName: null, lastName: null }));
  assert.ok(candidate.warnings.includes("MISSING_DISPLAY_NAME"));
  assert.deepEqual(validateUserDraft(candidate, buildUserDraft(candidate)), []);
});

test("invalid optional phone warns and is discarded", () => {
  const candidate = normalizeUserCandidate(source({ phone: "ambiguous" }));
  assert.equal(candidate.normalizedPhone, null);
  assert.ok(candidate.warnings.includes("INVALID_OPTIONAL_PHONE"));
});

test("invalid email blocks", () => {
  const candidate = normalizeUserCandidate(source({ email: "invalid" }));
  assert.deepEqual(validateUserDraft(candidate, buildUserDraft(candidate)), ["INVALID_EMAIL"]);
});

test("canonical hash is deterministic and excludes raw/legacy password noise", () => {
  const first = normalizeUserCandidate(source({ legacyPasswordPresent: false, sourceHash: "one" }));
  const second = normalizeUserCandidate(source({ legacyPasswordPresent: true, sourceHash: "two" }));
  assert.equal(buildUserCanonicalHash(first, buildUserDraft(first)), buildUserCanonicalHash(second, buildUserDraft(second)));
});

test("migration-relevant fields alter canonical hash", () => {
  const first = normalizeUserCandidate(source());
  const second = normalizeUserCandidate(source({ displayName: "Changed" }));
  assert.notEqual(buildUserCanonicalHash(first, buildUserDraft(first)), buildUserCanonicalHash(second, buildUserDraft(second)));
});
