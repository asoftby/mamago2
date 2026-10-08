import assert from "node:assert/strict";
import {
  generateInviteToken,
  hashInviteToken,
  isInviteUsable,
} from "./familyInvitePure";
import { familyInvitesEnabled } from "./familyScope";

const a = generateInviteToken();
const b = generateInviteToken();
assert.notEqual(a, b);
assert.ok(a.length >= 43);
assert.equal(hashInviteToken(a), hashInviteToken(a));
assert.notEqual(hashInviteToken(a), a);
assert.match(hashInviteToken(a), /^[0-9a-f]{64}$/);

const now = new Date("2026-10-06T00:00:00Z");
const past = new Date("2026-10-05T00:00:00Z");
const future = new Date("2026-10-07T00:00:00Z");
assert.equal(isInviteUsable({ status: "ACTIVE", expiresAt: null }, now), true, "no expiry");
assert.equal(isInviteUsable({ status: "ACTIVE", expiresAt: future }, now), true);
assert.equal(isInviteUsable({ status: "ACTIVE", expiresAt: past }, now), false, "legacy dated invite expires");
assert.equal(isInviteUsable({ status: "ACTIVE", expiresAt: now }, now), false);
assert.equal(isInviteUsable({ status: "REVOKED", expiresAt: null }, now), false);
assert.equal(isInviteUsable({ status: "ACCEPTED", expiresAt: null }, now), false);

assert.equal(familyInvitesEnabled({}), false);
assert.equal(familyInvitesEnabled({ FAMILY_INVITES: "1" }), true);
assert.equal(familyInvitesEnabled({ FAMILY_INVITES: "true" }), true);
assert.equal(familyInvitesEnabled({ FAMILY_INVITES: "0" }), false);
console.log("familyInvite.test: ok");
