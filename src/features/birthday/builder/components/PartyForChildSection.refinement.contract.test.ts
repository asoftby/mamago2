import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const source = fs.readFileSync(path.join(process.cwd(), "src/features/birthday/builder/components/PartyForChildSection.tsx"), "utf8");

assert.match(source, /setEditingProfileChild\(c\)/, "profile row/edit action binds the explicit child");
assert.match(source, /id: editingProfileChild\.id/, "PUT target comes from the explicit edit target");
assert.doesNotMatch(source, /id: current\.profileChildId/, "PUT must never derive its target from current scenario selection");
assert.match(source, /await persistBirthdayProfileChild[\s\S]*setPartyForChild\(party\)/, "selection happens only after a successful persisted update");

console.log("PartyForChildSection.refinement.contract.test.ts: OK");
