import assert from "node:assert/strict";
import { checkMakePrivate, checkShare, isEditConflict } from "./planVisibilityPure";

const priv = { userId: "a", visibility: "PRIVATE" as const, status: "CONFIRMED" as const };
const fam = { userId: "a", visibility: "FAMILY" as const, status: "CONFIRMED" as const };

assert.equal(checkShare("a", priv), null);
assert.equal(checkShare("b", priv), "not_author");
assert.equal(checkShare("a", fam), "wrong_state");
assert.equal(checkShare("a", { ...priv, status: "CANCELLED" }), "wrong_state");

assert.equal(checkMakePrivate("a", fam, 0), null);
assert.equal(checkMakePrivate("b", fam, 0), "not_author");
assert.equal(checkMakePrivate("a", fam, 1), "other_adult_acted");
assert.equal(checkMakePrivate("a", priv, 0), "wrong_state");
assert.equal(checkMakePrivate("a", { ...fam, status: "PROPOSED" }, 0), "wrong_state");
assert.equal(checkMakePrivate("a", { ...fam, status: "CANCELLED" }, 0), "wrong_state");

const t = new Date("2026-10-06T10:00:00.000Z");
assert.equal(isEditConflict(null, t), false);
assert.equal(isEditConflict(undefined, t), false);
assert.equal(isEditConflict(new Date(t), t), false);
assert.equal(isEditConflict(new Date(t.getTime() + 1), t), true);
console.log("planVisibility.test: ok");
