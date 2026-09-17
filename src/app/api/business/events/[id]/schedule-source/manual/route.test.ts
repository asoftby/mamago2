/**
 * Static wiring contract for the imported-schedule manual takeover endpoint.
 * Auth helpers require a real Next request scope, so this tier verifies the
 * destructive boundary directly in source, matching the existing wizard/API
 * wiring tests in this area.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(
  "src/app/api/business/events/[id]/schedule-source/manual/route.ts",
  "utf8",
);

assert.match(
  source,
  /canManageActivityById\(user, activityId\)/,
  "manual takeover must use normal event authorization",
);

assert.match(
  source,
  /where:\s*\{\s*activityId,\s*source:\s*\{\s*not:\s*null\s*}\s*}/,
  "takeover must operate only when import-owned sessions exist",
);

assert.match(
  source,
  /fieldName:\s*"scheduleJson"[\s\S]*?lockMode:\s*"PREFER_MANUAL"/,
  "takeover must make manual schedule ownership persistent for future imports",
);

assert.match(
  source,
  /prisma\.\$transaction\(\[/,
  "override, schedule seeding and session identity handoff must be atomic",
);

assert.match(
  source,
  /data:\s*\{\s*source:\s*null,\s*externalId:\s*null\s*}/,
  "takeover must clear only import identity from ActivitySession rows",
);

assert.doesNotMatch(
  source,
  /data:\s*\{[^}]*buyUrl:\s*null/,
  "takeover must not wipe ticket URLs",
);
assert.doesNotMatch(
  source,
  /data:\s*\{[^}]*priceMinCents:\s*null/,
  "takeover must not wipe imported prices",
);

assert.match(
  source,
  /scheduleItems,\s*\n\s*manualOverride:\s*true/,
  "endpoint must return seeded editable schedule rows to the wizard",
);

console.log("imported schedule manual takeover endpoint wiring test: OK");
