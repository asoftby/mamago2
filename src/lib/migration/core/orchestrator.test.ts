import assert from "node:assert/strict";

import { PHASE_7_COMMIT_MODE_ERROR, runMigrationCommit } from "./orchestrator";

async function main() {
  await assert.rejects(
    () => runMigrationCommit(),
    (error) =>
      error instanceof Error && error.message === PHASE_7_COMMIT_MODE_ERROR,
  );
}

main()
  .then(() => {
    console.log("migration commit mode guard tests: OK");
  })
  .catch((error) => {
    console.error("migration commit mode guard tests: FAILED", error);
    process.exitCode = 1;
  });
