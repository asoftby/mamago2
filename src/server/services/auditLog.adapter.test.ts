/**
 * logAudit() compatibility adapter tests (§21 Step 6, Phase E).
 * Run: DATABASE_URL=<isolated-db-url> npx tsx src/server/services/auditLog.adapter.test.ts
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { logAudit } from "./auditLog.service";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must point at an isolated test database");
}

const createdUserIds: string[] = [];
const marker = randomUUID().slice(0, 8);

async function makeUser(role: "USER" | "MODERATOR" | "ADMIN" | "BUSINESS_OWNER"): Promise<string> {
  const user = await prisma.user.create({
    data: { email: `audit-adapter-${marker}-${randomUUID()}@example.invalid`, role },
  });
  createdUserIds.push(user.id);
  return user.id;
}

async function cleanup() {
  await prisma.adminAuditLog.deleteMany({ where: { actorId: { in: createdUserIds } } });
  await prisma.auditLog.deleteMany({ where: { actorId: { in: createdUserIds } } });
  await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
}

async function main() {
  try {
    // 1+2+5. No dual-write: 0 new AuditLog rows, exactly 1 AdminAuditLog row.
    const moderatorId = await makeUser("MODERATOR");
    const targetUserId = await makeUser("USER");

    const auditLogCountBefore = await prisma.auditLog.count();
    const adminAuditLogCountBefore = await prisma.adminAuditLog.count();

    const result = await logAudit({
      actorId: moderatorId,
      targetType: "USER",
      targetId: targetUserId,
      action: "USER_WARNED",
      metadata: { reason: "spam", note: "second warning" },
      ipAddress: "203.0.113.7",
      userAgent: "AdapterTest/1.0",
    });

    const auditLogCountAfter = await prisma.auditLog.count();
    const adminAuditLogCountAfter = await prisma.adminAuditLog.count();

    assert.equal(auditLogCountAfter, auditLogCountBefore, "logAudit must create 0 new AuditLog rows");
    assert.equal(
      adminAuditLogCountAfter,
      adminAuditLogCountBefore + 1,
      "logAudit must create exactly 1 AdminAuditLog row",
    );

    // 3. Field mapping.
    assert.equal(result.actorId, moderatorId, "actorId must be preserved");
    assert.equal(result.actorRole, "MODERATOR", "actorRole must be the actor's real, current User.role");
    assert.equal(result.action, "USER_WARNED", "action must be preserved");
    assert.equal(result.entityType, "USER", "targetType must map to entityType");
    assert.equal(result.entityId, targetUserId, "targetId must map to entityId");

    const metadata = result.metadata as Record<string, unknown>;
    assert.equal(metadata.reason, "spam", "caller-owned metadata keys must be preserved");
    assert.equal(metadata.note, "second warning", "caller-owned metadata keys must be preserved");

    // 4. ipAddress/userAgent preserved in canonical metadata, namespaced so
    // they never collide with a caller-owned key.
    const legacyContext = metadata.legacyContext as Record<string, unknown>;
    assert.equal(legacyContext.ipAddress, "203.0.113.7", "ipAddress must be preserved in canonical metadata");
    assert.equal(legacyContext.userAgent, "AdapterTest/1.0", "userAgent must be preserved in canonical metadata");

    // 7. Return contract: no caller in the codebase reads the return value's
    // fields (verified by audit — every call-site is `await logAudit({...})`
    // with no assignment), so returning the canonical AdminAuditLog row is
    // acceptable. Prove the row itself is real and queryable.
    const persisted = await prisma.adminAuditLog.findUniqueOrThrow({ where: { id: result.id } });
    assert.equal(persisted.entityId, targetUserId);

    // Old AuditLog rows remain untouched and readable through the existing
    // legacy read helper — simulate a pre-adapter historical row.
    const historicalLog = await prisma.auditLog.create({
      data: {
        actorId: moderatorId,
        targetType: "USER",
        targetId: targetUserId,
        action: "USER_WARNED_HISTORICAL",
        metadata: { reason: "pre-adapter historical row" },
      },
    });

    const { getUserAuditLog } = await import("./auditLog.service");
    const userLogs = await getUserAuditLog(targetUserId, 50);
    assert.ok(
      userLogs.some((l) => l.id === historicalLog.id),
      "the historical AuditLog row must remain readable through getUserAuditLog",
    );
    const stillThere = await prisma.auditLog.findUniqueOrThrow({ where: { id: historicalLog.id } });
    assert.equal(stillThere.action, "USER_WARNED_HISTORICAL", "historical AuditLog row content must be untouched");

    // No metadata -> no dual-write, no fabricated legacyContext key when
    // neither ipAddress nor userAgent was supplied.
    {
      const bareModeratorId = await makeUser("ADMIN");
      const noContextResult = await logAudit({
        actorId: bareModeratorId,
        targetType: "USER",
        targetId: targetUserId,
        action: "USER_ROLE_CHANGED",
      });
      const noContextMetadata = noContextResult.metadata as Record<string, unknown> | null;
      assert.ok(
        !noContextMetadata || !("legacyContext" in noContextMetadata),
        "legacyContext must not be fabricated when ipAddress/userAgent were never supplied",
      );
      assert.equal(noContextResult.actorRole, "ADMIN");
    }

    // 8. Unresolved actor: never fabricates a role — the lookup must throw,
    // matching the old FK-violation failure mode.
    await assert.rejects(
      () =>
        logAudit({
          actorId: "does-not-exist-" + randomUUID(),
          targetType: "USER",
          targetId: targetUserId,
          action: "USER_WARNED",
        }),
      "logAudit must throw rather than fabricate an actorRole for an unresolvable actor",
    );

    console.log("auditLog.adapter.test.ts: OK");
  } finally {
    await cleanup();
    await prisma.$disconnect();
  }
}

main().then(
  () => process.exit(0),
  (err) => {
    console.error(err);
    process.exit(1);
  },
);
