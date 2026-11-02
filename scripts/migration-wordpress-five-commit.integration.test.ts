/**
 * Real PostgreSQL regression of five-user recovery:
 * injected failure on 3rd create rolls back ALL 5 User/lineage/record rows;
 * subsequent full create makes exactly 5 nonprivileged accounts;
 * rerun skips all 5 without modifying users.
 *
 * Runs ONLY on ephemeral CI database 'seo_redirect_test'. No PROD/DEV.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { PrismaClient } from "@prisma/client";

import {
  buildUserDraft, buildUserCanonicalHash, normalizeUserCandidate,
} from "../src/lib/migration/commit/user/UserMigrationVerticalSlice";
import { hashBackfillEmail } from "../src/lib/migration/commit/user/productionExclusionBackfillPolicy";
import {
  FIVE_RECOVERY_KEYS, FIVE_RECOVERY_NAMESPACE,
  type FiveRecoveryApproval,
} from "../src/lib/migration/commit/user/wordpressFiveArchiveBackfillPolicy";
import {
  sourceCandidate, type SourceInput,
} from "./migration-wordpress-five-preview";
import {
  commitApprovedFiveAtomic, type Planned,
} from "./migration-wordpress-five-commit";

const archiveSha256 = "a".repeat(64);
const manifestSha256 = "b".repeat(64);
const emails = [7, 17, 22, 42, 43].map(i =>
  "wp-1064-ci-identity-" + i + "@example.invalid",
);
const source: SourceInput = {
  archiveSha256,
  sourceRecords: FIVE_RECOVERY_KEYS.map((sourceRecordKey, index) => ({
    sourceRecordKey,
    email: emails[index],
    displayName: "Synthetic archived user " + (index + 1),
  })),
};
const planned: Planned[] = source.sourceRecords.map(raw => {
  const record = sourceCandidate(source, raw);
  const candidate = normalizeUserCandidate(record);
  const draft = buildUserDraft(candidate);
  assert.ok(draft, "valid, non-privileged source must produce USER draft");
  return {
    sourceRecordKey: record.sourceRecordKey,
    email: candidate.normalizedEmail!,
    canonicalHash: buildUserCanonicalHash(candidate, draft),
    sourceHash: record.sourceHash,
    candidate, draft,
  };
});
const approval: FiveRecoveryApproval = {
  schemaVersion: 1, issue: 1064, approvedBy: "FOUNDER",
  approvedAt: "2026-11-02T00:00:00.000Z",
  archiveSha256, sourceNamespace: FIVE_RECOVERY_NAMESPACE,
  entries: planned.map(p => ({
    sourceRecordKey: p.sourceRecordKey,
    emailSha256: hashBackfillEmail(p.email),
    canonicalHash: p.canonicalHash, sourceHash: p.sourceHash,
    action: "CREATE",
  })),
};

test("five-user recovery is atomic, idempotent and has zero business/permission writes", async t => {
  if (process.env.FIVE_WP_RECOVERY_PG_TEST !== "1") {
    t.skip("Only available with isolated PostgreSQL integration flag");
    return;
  }
  const prisma = new PrismaClient();
  let safeToClean = false;
  const trigger = "_wp1064_ci_fail_third_user";
  const func = "_wp1064_ci_fail_third_user_fn";
  try {
    const db = await prisma.$queryRawUnsafe<Array<{ current_database: string }>>(
      "SELECT current_database()",
    );
    assert.equal(db[0]?.current_database, "seo_redirect_test",
      "Never write to a non-isolated test database");
    const existingSource = await prisma.migrationSource.findUnique({
      where: {
        adapterKey_sourceNamespace: {
          adapterKey: "wordpress-db",
          sourceNamespace: FIVE_RECOVERY_NAMESPACE,
        },
      },
    });
    const existingUsers = await prisma.user.count({
      where: { email: { in: emails } },
    });
    assert.equal(existingUsers, 0, "test email already exists: refuse cleanup/import");
    assert.equal(existingSource, null, "test source namespace already exists: refuse cleanup/import");
    safeToClean = true;

    const before = {
      users: await prisma.user.count(),
      businesses: await prisma.business.count(),
      memberships: await prisma.businessMember.count(),
      activities: await prisma.activity.count(),
      lineages: await prisma.migrationLineage.count(),
    };

    await prisma.$executeRawUnsafe(
      'CREATE FUNCTION "' + func + '"() RETURNS trigger LANGUAGE plpgsql AS ' +
      "$BODY$ BEGIN IF NEW.email = '" + emails[2] + "' THEN " +
      "RAISE EXCEPTION 'SYNTHETIC_THIRD_USER_FAILURE'; END IF; " +
      "RETURN NEW; END; $BODY$",
    );
    await prisma.$executeRawUnsafe(
      'CREATE TRIGGER "' + trigger + '" BEFORE INSERT ON "User" ' +
      'FOR EACH ROW EXECUTE FUNCTION "' + func + '"()',
    );
    await assert.rejects(() => commitApprovedFiveAtomic(
      prisma, planned, approval, archiveSha256, manifestSha256,
    ), "failure on 3rd User must abort all five User CREATE operations");
    assert.equal(await prisma.user.count(), before.users);
    assert.equal(await prisma.migrationLineage.count(), before.lineages);
    assert.equal(await prisma.migrationSource.count({
      where: { sourceNamespace: FIVE_RECOVERY_NAMESPACE },
    }), 0, "source audit must roll back with User creates");
    assert.equal(await prisma.business.count(), before.businesses);
    assert.equal(await prisma.businessMember.count(), before.memberships);
    assert.equal(await prisma.activity.count(), before.activities);

    await prisma.$executeRawUnsafe('DROP TRIGGER "' + trigger + '" ON "User"');
    await prisma.$executeRawUnsafe('DROP FUNCTION "' + func + '"()');

    const applied = await commitApprovedFiveAtomic(
      prisma, planned, approval, archiveSha256, manifestSha256,
    );
    assert.equal(applied.created, 5);
    assert.equal(applied.skipped, 0);
    assert.equal(applied.after.users, before.users + 5);
    assert.equal(applied.after.businesses, before.businesses);
    assert.equal(applied.after.members, before.memberships);
    assert.equal(applied.after.activities, before.activities);
    const created = await prisma.user.findMany({
      where: { email: { in: emails } },
      select: {
        email: true, role: true, status: true,
        passwordHash: true, emailVerifiedAt: true, phoneE164: true,
      },
    });
    assert.equal(created.length, 5);
    for (const user of created) {
      assert.equal(user.role, "USER");
      assert.equal(user.status, "PENDING_ACTIVATION");
      assert.equal(user.passwordHash, null);
      assert.equal(user.emailVerifiedAt, null);
      assert.equal(user.phoneE164, null);
    }
    assert.equal(await prisma.migrationLineage.count({
      where: {
        sourceRecordKey: { in: [...FIVE_RECOVERY_KEYS] },
        targetType: "USER", isActive: true,
        source: { sourceNamespace: FIVE_RECOVERY_NAMESPACE },
      },
    }), 5);

    const repeated = await commitApprovedFiveAtomic(
      prisma, planned, approval, archiveSha256, manifestSha256,
    );
    assert.equal(repeated.created, 0);
    assert.equal(repeated.skipped, 5);
    assert.equal(await prisma.user.count(), before.users + 5);
    assert.equal(await prisma.migrationLineage.count(), before.lineages + 5);
  } finally {
    if (safeToClean) {
      await prisma.$executeRawUnsafe(
        'DROP TRIGGER IF EXISTS "' + trigger + '" ON "User"',
      );
      await prisma.$executeRawUnsafe(
        'DROP FUNCTION IF EXISTS "' + func + '"()',
      );
      await prisma.migrationSource.deleteMany({
        where: {
          adapterKey: "wordpress-db",
          sourceNamespace: FIVE_RECOVERY_NAMESPACE,
        },
      });
      await prisma.user.deleteMany({ where: { email: { in: emails } } });
    }
    await prisma.$disconnect();
  }
});
