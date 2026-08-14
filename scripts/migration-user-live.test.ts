import assert from "node:assert/strict";

import { parseLiveUserArgs } from "./migration-user-live";

assert.deepEqual(parseLiveUserArgs(["--preview", "--allow-remote-readonly"]), {
  preview: true,
  confirmWrites: false,
  confirmProduction: false,
  acknowledgeProdUserImport: false,
  allowRemoteReadonly: true,
  limit: undefined,
});

assert.throws(() => parseLiveUserArgs([]), /exactly one of --preview or --confirm-writes/);
assert.throws(
  () => parseLiveUserArgs(["--preview", "--confirm-writes"]),
  /exactly one of --preview or --confirm-writes/,
);

const commit = parseLiveUserArgs([
  "--confirm-writes",
  "--confirm-production",
  "--acknowledge-prod-user-import",
  "--allow-remote-readonly",
  "--limit",
  "10",
]);
assert.equal(commit.preview, false);
assert.equal(commit.confirmWrites, true);
assert.equal(commit.confirmProduction, true);
assert.equal(commit.acknowledgeProdUserImport, true);
assert.equal(commit.limit, 10);

console.log("migration-user-live parseArgs tests: OK");
