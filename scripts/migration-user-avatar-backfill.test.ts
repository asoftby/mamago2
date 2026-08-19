import assert from "node:assert/strict";

import { parseUserAvatarBackfillArgs } from "./migration-user-avatar-backfill";

assert.deepEqual(parseUserAvatarBackfillArgs(["--preview", "--allow-remote-readonly"]), {
  preview: true,
  confirmWrites: false,
  confirmProduction: false,
  acknowledgeProdUserImport: false,
  allowRemoteReadonly: true,
  limit: undefined,
});

assert.throws(() => parseUserAvatarBackfillArgs([]), /exactly one of --preview or --confirm-writes/);
assert.throws(
  () => parseUserAvatarBackfillArgs(["--preview", "--confirm-writes"]),
  /exactly one of --preview or --confirm-writes/,
);

const commit = parseUserAvatarBackfillArgs([
  "--confirm-writes",
  "--confirm-production",
  "--acknowledge-prod-user-import",
  "--allow-remote-readonly",
  "--limit",
  "25",
]);
assert.equal(commit.preview, false);
assert.equal(commit.confirmWrites, true);
assert.equal(commit.confirmProduction, true);
assert.equal(commit.acknowledgeProdUserImport, true);
assert.equal(commit.limit, 25);

assert.throws(() => parseUserAvatarBackfillArgs(["--confirm-writes", "--limit", "0"]), /Invalid --limit/);
assert.throws(() => parseUserAvatarBackfillArgs(["--confirm-writes", "--limit", "abc"]), /Invalid --limit/);

console.log("migration-user-avatar-backfill parseArgs tests: OK");
