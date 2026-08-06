/**
 * Regression tests for the safety-fix lockdown of /api/admin/ranking:
 *   - RankingSettings/BoostSettings mutations are locked (403), values untouched.
 *   - StoryIntentConfig mutations keep optimistic concurrency + audit log.
 * Exercises the testable core directly (adminRankingHandlers.ts) rather than the
 * route.ts handlers, because getCurrentUser()'s cookies() call throws "outside a
 * request scope" when invoked outside a real Next.js request — see route.ts,
 * which resolves the actor via requireAdmin() and passes it in.
 *
 * Real dev DB, no mocking (repo convention). Only ever creates/mutates disposable
 * test-only rows (unique test user ids, StoryIntentConfig rows with a
 * `test-intent-*` intent key that getPublicStoryIntentConfigs() never selects —
 * see PUBLIC_STORY_INTENT_KEYS in storyIntentConfig.ts). The live production
 * RankingSettings/BoostSettings singleton and the 5 live StoryIntentConfig rows
 * (today/tomorrow/weekend/breaking_news/free) are read for comparison but never
 * written to.
 *
 * Запуск: set -a; source .env; set +a; npx tsx src/server/services/ranking/adminRankingHandlers.test.ts
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { handleRankingGet, handleRankingPost, isRankingAdmin } from "./adminRankingHandlers";
import type { AuthActor } from "@/lib/auth/safeUser";

const cleanupUserIds: string[] = [];
const cleanupIntentIds: string[] = [];

async function createTestUser(role: "ADMIN" | "MODERATOR" | "USER"): Promise<AuthActor> {
  const user = await prisma.user.create({
    data: { email: `test-admin-ranking-${randomUUID()}@test.local`, role },
  });
  cleanupUserIds.push(user.id);
  return { id: user.id, role: user.role };
}

async function createTestIntent(overrides: Partial<{ title: string; enabled: boolean; order: number }> = {}) {
  const intent = await prisma.storyIntentConfig.create({
    data: {
      intent: `test-intent-${randomUUID()}`,
      title: overrides.title ?? "Original title",
      enabled: overrides.enabled ?? true,
      order: overrides.order ?? 0,
      itemLimit: 5,
      allowedTypes: [],
    },
  });
  cleanupIntentIds.push(intent.id);
  return intent;
}

async function main() {
  console.log("Starting admin ranking handlers tests...");
  try {
    const admin = await createTestUser("ADMIN");
    const moderator = await createTestUser("MODERATOR");
    const plainUser = await createTestUser("USER");

    // --- permissions ---
    assert.equal(isRankingAdmin(null), false);
    assert.equal(isRankingAdmin(plainUser), false);
    assert.equal(isRankingAdmin(admin), true);
    assert.equal(isRankingAdmin(moderator), true);

    assert.equal((await handleRankingGet(null)).status, 401, "unauthenticated GET must be 401");
    assert.equal((await handleRankingGet(plainUser)).status, 401, "USER role GET must be 401");
    assert.equal((await handleRankingGet(admin)).status, 200, "ADMIN GET must succeed");
    assert.equal((await handleRankingGet(moderator)).status, 200, "MODERATOR GET must succeed (matches existing role gate)");
    assert.equal((await handleRankingPost(null, "intent", {})).status, 401, "unauthenticated POST must be 401");

    // --- GET reflects real current DB values, does not fabricate them ---
    {
      const [dbRanking, dbBoost] = await Promise.all([
        prisma.rankingSettings.findUnique({ where: { id: "singleton" } }),
        prisma.boostSettings.findUnique({ where: { id: "singleton" } }),
      ]);
      const res = await handleRankingGet(admin);
      assert.equal(res.status, 200);
      const body = res.body as { ranking: { freshnessWeight: number }; boost: { maxBoostScore: number } };
      assert.equal(body.ranking.freshnessWeight, dbRanking?.freshnessWeight);
      assert.equal(body.boost.maxBoostScore, dbBoost?.maxBoostScore);
    }

    // --- POST type=ranking/boost is locked 403 and never mutates the singleton ---
    {
      const before = await prisma.rankingSettings.findUniqueOrThrow({ where: { id: "singleton" } });
      const res = await handleRankingPost(admin, "ranking", { freshnessWeight: 999 });
      assert.equal(res.status, 403, "ranking weights mutation must be rejected");
      const after = await prisma.rankingSettings.findUniqueOrThrow({ where: { id: "singleton" } });
      assert.deepEqual(after, before, "RankingSettings singleton must be byte-for-byte unchanged");
    }
    {
      const before = await prisma.boostSettings.findUniqueOrThrow({ where: { id: "singleton" } });
      const res = await handleRankingPost(admin, "boost", { maxBoostScore: 999999, repeatCooldown: 1 });
      assert.equal(res.status, 403, "boost rules mutation must be rejected");
      const after = await prisma.boostSettings.findUniqueOrThrow({ where: { id: "singleton" } });
      assert.deepEqual(after, before, "BoostSettings singleton must be byte-for-byte unchanged");
    }
    {
      // MODERATOR is allowed on this route (unlike search/ranking) but still hits the 403 lock.
      const res = await handleRankingPost(moderator, "ranking", { freshnessWeight: 2 });
      assert.equal(res.status, 403);
    }

    // --- unknown type ---
    assert.equal((await handleRankingPost(admin, undefined, {})).status, 400);

    // --- StoryIntentConfig: optimistic concurrency + audit trail + cache-invalidation flag ---
    {
      const intent = await createTestIntent();
      const auditCountBefore = await prisma.adminAuditLog.count({
        where: { entityType: "STORY_INTENT_CONFIG", entityId: intent.id },
      });
      assert.equal(auditCountBefore, 0);

      // 1. Successful update with a fresh updatedAt.
      const res = await handleRankingPost(admin, "intent", {
        id: intent.id,
        updatedAt: intent.updatedAt.toISOString(),
        title: "Updated title",
        enabled: intent.enabled,
        order: intent.order,
      });
      assert.equal(res.status, 200, "update with current updatedAt must succeed");
      assert.equal(res.invalidateCache, true, "a successful change must request cache invalidation");
      assert.equal((res.body as { title: string }).title, "Updated title");

      const rowAfterSuccess = await prisma.storyIntentConfig.findUniqueOrThrow({ where: { id: intent.id } });
      assert.equal(rowAfterSuccess.title, "Updated title");

      const auditRows = await prisma.adminAuditLog.findMany({
        where: { entityType: "STORY_INTENT_CONFIG", entityId: intent.id },
        orderBy: { createdAt: "asc" },
      });
      assert.equal(auditRows.length, 1, "exactly one audit row after the successful update");
      assert.equal(auditRows[0].actorId, admin.id, "audit actor must be the server-resolved actor, not payload-derived");
      assert.equal(auditRows[0].actorRole, admin.role);
      assert.equal(auditRows[0].action, "STORY_INTENT_CONFIG_UPDATE");
      assert.deepEqual(auditRows[0].before, { title: "Original title", enabled: intent.enabled, order: intent.order });
      assert.deepEqual(auditRows[0].after, { title: "Updated title", enabled: intent.enabled, order: intent.order });

      // 2. Conflicting update reusing the now-stale updatedAt must be rejected, not silently overwrite.
      const conflictRes = await handleRankingPost(admin, "intent", {
        id: intent.id,
        updatedAt: intent.updatedAt.toISOString(), // stale: row changed in step 1
        title: "Should never apply",
        enabled: intent.enabled,
        order: intent.order,
      });
      assert.equal(conflictRes.status, 409, "stale updatedAt must return 409");
      assert.equal(conflictRes.invalidateCache, undefined, "a rejected conflict must not request cache invalidation");

      const rowAfterConflict = await prisma.storyIntentConfig.findUniqueOrThrow({ where: { id: intent.id } });
      assert.equal(rowAfterConflict.title, "Updated title", "conflicting update must not overwrite existing data");

      const auditRowsAfterConflict = await prisma.adminAuditLog.findMany({
        where: { entityType: "STORY_INTENT_CONFIG", entityId: intent.id },
      });
      assert.equal(auditRowsAfterConflict.length, 1, "a rejected conflict must not create a false audit entry");

      // 3. A second, different actor succeeding afterwards must be attributed correctly.
      const freshRow = await prisma.storyIntentConfig.findUniqueOrThrow({ where: { id: intent.id } });
      const res2 = await handleRankingPost(moderator, "intent", {
        id: intent.id,
        updatedAt: freshRow.updatedAt.toISOString(),
        title: "Second update",
        enabled: freshRow.enabled,
        order: freshRow.order,
      });
      assert.equal(res2.status, 200);
      const auditRows2 = await prisma.adminAuditLog.findMany({
        where: { entityType: "STORY_INTENT_CONFIG", entityId: intent.id },
        orderBy: { createdAt: "asc" },
      });
      assert.equal(auditRows2.length, 2);
      assert.equal(auditRows2[1].actorId, moderator.id, "second update's audit actor must reflect the actual caller");
      assert.equal(auditRows2[1].actorRole, "MODERATOR");
    }

    // --- unknown intent id ---
    {
      const res = await handleRankingPost(admin, "intent", {
        id: "does-not-exist",
        updatedAt: new Date().toISOString(),
        title: "x",
      });
      assert.equal(res.status, 404);
    }

    console.log("admin ranking handlers tests: OK");
  } finally {
    if (cleanupIntentIds.length) {
      await prisma.adminAuditLog.deleteMany({ where: { entityType: "STORY_INTENT_CONFIG", entityId: { in: cleanupIntentIds } } });
      await prisma.storyIntentConfig.deleteMany({ where: { id: { in: cleanupIntentIds } } });
    }
    if (cleanupUserIds.length) {
      await prisma.user.deleteMany({ where: { id: { in: cleanupUserIds } } });
    }
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
