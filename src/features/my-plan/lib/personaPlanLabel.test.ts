import assert from "node:assert/strict";
import { personaPlanLabel } from "./personaPlanLabel";

assert.equal(personaPlanLabel({ kind: "adult", displayName: "Алексей", isProfileComplete: true }), "Алексей (Я)");
assert.equal(personaPlanLabel({ kind: "adult", displayName: "asoftby", isProfileComplete: false }), "Я");
assert.equal(personaPlanLabel({ kind: "adult", displayName: "", isProfileComplete: true }), "Я");
assert.equal(personaPlanLabel({ kind: "adult", displayName: null }), "Я");
assert.equal(personaPlanLabel({ kind: "child", displayName: " Тая " }), "Тая");
assert.equal(personaPlanLabel({ kind: "child", displayName: null }), "");

console.log("personaPlanLabel: OK");
