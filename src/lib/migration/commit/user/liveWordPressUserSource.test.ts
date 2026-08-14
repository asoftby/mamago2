import assert from "node:assert/strict";

import {
  classifyLiveUserEligibility,
  liveUserSourceRecordKey,
  userSourceCandidateFromWordPressRow,
} from "./liveWordPressUserSource";
import { normalizeUserCandidate, planUserMigration } from "./UserMigrationVerticalSlice";

assert.equal(liveUserSourceRecordKey(38), "wordpress-db:user:38");

const candidate = userSourceCandidateFromWordPressRow({
  ID: 38,
  user_login: "anna",
  user_email: "Anna@Example.com",
  user_registered: "2020-01-01 00:00:00",
  display_name: "Anna",
});
assert.equal(candidate.legacyPasswordPresent, false);
assert.deepEqual(candidate.legacyRoles, []);
assert.equal(candidate.privilegedCollision, false);

const normalized = normalizeUserCandidate(candidate);
assert.equal(normalized.normalizedEmail, "anna@example.com");
assert.equal(normalized.classification, "ORDINARY");

const excluded = new Set(["wordpress-db:user:7"]);
assert.deepEqual(classifyLiveUserEligibility("wordpress-db:user:7", excluded), {
  eligible: false,
  exclusionReason: "FOUNDER_EXCLUSION",
});
assert.deepEqual(classifyLiveUserEligibility("wordpress-db:user:38", excluded), {
  eligible: true,
  exclusionReason: null,
});

const plans: Array<{ email: string; role: string }> = [];
const fakePrisma = {
  migrationSource: { findUnique: async () => null },
  migrationLineage: { findUnique: async () => null },
  user: {
    findUnique: async (args: { where: { email: string }; select: { id: true; role: true } }) => {
      plans.push({ email: args.where.email, role: "lookup" });
      if (args.where.email === "admin@example.com") return { id: "admin-1", role: "ADMIN" };
      if (args.where.email === "taken@example.com") return { id: "user-1", role: "USER" };
      return null;
    },
  },
} as const;

async function main() {
{
  const privileged = normalizeUserCandidate(
    userSourceCandidateFromWordPressRow({
      ID: 99,
      user_login: "admin",
      user_email: "admin@example.com",
      user_registered: "2020-01-01 00:00:00",
      display_name: "Admin",
    }),
  );
  const plan = await planUserMigration(fakePrisma as never, privileged, "wordpress-db-live-users");
  assert.equal(plan.action, "BLOCKED");
  assert.equal(plan.reason, "PRIVILEGED_ACCOUNT_COLLISION");
}

{
  const taken = normalizeUserCandidate(
    userSourceCandidateFromWordPressRow({
      ID: 100,
      user_login: "taken",
      user_email: "taken@example.com",
      user_registered: "2020-01-01 00:00:00",
      display_name: "Taken",
    }),
  );
  const plan = await planUserMigration(fakePrisma as never, taken, "wordpress-db-live-users");
  assert.equal(plan.action, "BLOCKED");
  assert.equal(plan.reason, "EXISTING_USER_EMAIL_COLLISION");
}

{
  const fresh = normalizeUserCandidate(
    userSourceCandidateFromWordPressRow({
      ID: 101,
      user_login: "fresh",
      user_email: "fresh@example.com",
      user_registered: "2020-01-01 00:00:00",
      display_name: "Fresh",
    }),
  );
  const plan = await planUserMigration(fakePrisma as never, fresh, "wordpress-db-live-users");
  assert.equal(plan.action, "CREATE");
  assert.equal(plan.draft?.passwordHash, null);
  assert.equal(plan.draft?.status, "PENDING_ACTIVATION");
}

{
  const first = await planUserMigration(
    {
      ...fakePrisma,
      migrationSource: { findUnique: async () => ({ id: "src" }) },
      migrationLineage: {
        findUnique: async () => ({
          isActive: true,
          lastSourceHash: (await planUserMigration(fakePrisma as never, normalizeUserCandidate(candidate), "wordpress-db-live-users")).canonicalHash,
          targetId: "existing-user",
        }),
      },
    } as never,
    normalizeUserCandidate(candidate),
    "wordpress-db-live-users",
  );
  assert.equal(first.action, "SKIP_UNCHANGED");
}

console.log("liveWordPressUserSource tests: OK");
}

void main();
