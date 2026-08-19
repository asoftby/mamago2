import assert from "node:assert/strict";

import { isValidUnpChecksum } from "./unpChecksum";

// --- valid: real УНП from GRP example payload in the task spec ---
assert.equal(isValidUnpChecksum("691868900"), true);

// --- valid: synthetic checksum computed via the same algorithm ---
assert.equal(isValidUnpChecksum("100000007"), true);

// --- invalid: correct format, wrong check digit ---
assert.equal(isValidUnpChecksum("691868901"), false);
assert.equal(isValidUnpChecksum("100000008"), false);

// --- invalid: wrong length / non-digit characters ---
assert.equal(isValidUnpChecksum("12345678"), false);
assert.equal(isValidUnpChecksum("1234567890"), false);
assert.equal(isValidUnpChecksum("69186890A"), false);
assert.equal(isValidUnpChecksum(""), false);

console.log("unpChecksum tests: OK");
