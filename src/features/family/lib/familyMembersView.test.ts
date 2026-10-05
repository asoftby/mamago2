import assert from "node:assert/strict";
import { adultDisplayName, familyActions, familyErrorMessage, roleLabel } from "./familyMembersView";

assert.equal(roleLabel("OWNER"), "Владелец");
assert.equal(roleLabel("ADULT"), "Взрослый");
assert.match(familyErrorMessage("owner_must_transfer"), /передайте роль/);
assert.match(familyErrorMessage("rate_limited"), /ссылку/);
assert.match(familyErrorMessage("whatever"), /Не получилось/);
assert.match(familyErrorMessage(undefined), /Не получилось/);

assert.deepEqual(familyActions({ myRole: "OWNER", adultsCount: 1, invitesEnabled: true }), { canInvite: true, canLeave: false, canTransfer: false });
assert.deepEqual(familyActions({ myRole: "OWNER", adultsCount: 2, invitesEnabled: true }), { canInvite: true, canLeave: false, canTransfer: true });
assert.deepEqual(familyActions({ myRole: "ADULT", adultsCount: 2, invitesEnabled: false }), { canInvite: false, canLeave: true, canTransfer: false });

assert.equal(adultDisplayName({ displayName: " Аня ", isMe: true }), "Аня (вы)");
assert.equal(adultDisplayName({ displayName: null, isMe: true }), "Вы");
assert.equal(adultDisplayName({ displayName: null, isMe: false }), "Взрослый");
console.log("familyMembersView.test: ok");
