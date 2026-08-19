/**
 * Regression/contract test for the extended /api/health response
 * (mamaGo Operations Center v1 — Step 0 prerequisites).
 *
 * Exercises the real exported GET() against the local dev DB.
 *
 * Run: set -a; source .env; set +a; npx tsx src/app/api/health/route.test.ts
 */
import assert from "node:assert/strict";

import { GET } from "./route";

const ISO_8601 = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

async function main() {
  const res1 = await GET();
  assert.equal(res1.status, 200);
  const body1 = await res1.json();

  // Existing contract preserved.
  assert.equal(body1.status, "ok");
  assert.equal(body1.db, "ok");

  // New build metadata fields present.
  assert.ok("buildId" in body1, "buildId field must be present");
  assert.ok("gitSha" in body1, "gitSha field must be present");
  assert.match(body1.processStartedAt, ISO_8601, "processStartedAt must be ISO-8601");

  const res2 = await GET();
  const body2 = await res2.json();
  assert.equal(
    body1.processStartedAt,
    body2.processStartedAt,
    "processStartedAt must be stable across requests within the same process",
  );

  console.log("route.test.ts (health): OK");
}

main().then(
  () => process.exit(0),
  (err) => {
    console.error(err);
    process.exit(1);
  },
);
