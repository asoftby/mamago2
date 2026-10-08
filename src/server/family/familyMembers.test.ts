import assert from "node:assert/strict";
import {
  INVITE_EMAILS_PER_USER_PER_DAY,
  checkLeave,
  checkTransfer,
  mapLeaverPlanChildId,
  normalizeInviteEmail,
} from "./familyMembersPure";

assert.deepEqual(checkLeave({ role: "ADULT", activeAdults: 2 }), { ok: true });
assert.deepEqual(checkLeave({ role: "OWNER", activeAdults: 2 }), { ok: false, code: "owner_must_transfer" });
assert.deepEqual(checkLeave({ role: "OWNER", activeAdults: 1 }), { ok: false, code: "last_adult" });
assert.deepEqual(checkLeave({ role: "ADULT", activeAdults: 1 }), { ok: false, code: "last_adult" });

const base = { actorRole: "OWNER" as const, actorId: "a", targetId: "b", targetIsActiveMember: true };
assert.deepEqual(checkTransfer(base), { ok: true });
assert.deepEqual(checkTransfer({ ...base, actorRole: "ADULT" }), { ok: false, code: "not_owner" });
assert.deepEqual(checkTransfer({ ...base, actorRole: null }), { ok: false, code: "not_owner" });
assert.deepEqual(checkTransfer({ ...base, targetId: "a" }), { ok: false, code: "same_user" });
assert.deepEqual(checkTransfer({ ...base, targetIsActiveMember: false }), { ok: false, code: "target_not_member" });

assert.equal(normalizeInviteEmail("  Mama@Example.COM "), "mama@example.com");
assert.equal(normalizeInviteEmail("nope"), null);
assert.equal(normalizeInviteEmail("a b@c.d"), null);
assert.equal(normalizeInviteEmail(`${"a".repeat(250)}@x.by`), null);
assert.ok(INVITE_EMAILS_PER_USER_PER_DAY > 0 && INVITE_EMAILS_PER_USER_PER_DAY <= 10);

const map = new Map([["old1", "new1"]]);
assert.equal(mapLeaverPlanChildId(null, map), null);
assert.equal(mapLeaverPlanChildId("old1", map), "new1");
assert.equal(mapLeaverPlanChildId("old2", map), null, "uncopied child → link dropped");
console.log("familyMembers.test: ok");
