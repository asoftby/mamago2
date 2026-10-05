import assert from "node:assert/strict";
import {
  INVITE_TTL_DAYS,
  generateInviteToken,
  hashInviteToken,
  inviteExpiresAt,
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
const exp = inviteExpiresAt(now);
assert.equal((exp.getTime() - now.getTime()) / 86_400_000, INVITE_TTL_DAYS);
assert.equal(isInviteUsable({ status: "ACTIVE", expiresAt: exp }, now), true);
assert.equal(isInviteUsable({ status: "ACTIVE", expiresAt: exp }, exp), false);
assert.equal(isInviteUsable({ status: "REVOKED", expiresAt: exp }, now), false);
assert.equal(isInviteUsable({ status: "ACCEPTED", expiresAt: exp }, now), false);

assert.equal(familyInvitesEnabled({}), false);
assert.equal(familyInvitesEnabled({ FAMILY_INVITES: "1" }), true);
assert.equal(familyInvitesEnabled({ FAMILY_INVITES: "true" }), true);
assert.equal(familyInvitesEnabled({ FAMILY_INVITES: "0" }), false);
console.log("familyInvite.test: ok");
