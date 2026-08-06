/**
 * Regression tests for the safety-fix lockdown of /api/admin/search/ranking:
 * SearchRankingSettings mutations are locked (403/401), values untouched.
 * Exercises the testable core directly (adminSearchRankingHandlers.ts) rather
 * than the route.ts handlers, because getCurrentUser()'s cookies() call throws
 * "outside a request scope" when invoked outside a real Next.js request — see
 * route.ts, which resolves the actor via getCurrentUser() and passes it in.
 *
 * Real dev DB, no mocking (repo convention). Never writes to SearchRankingSettings.
 *
 * Запуск: set -a; source .env; set +a; npx tsx src/server/services/search/adminSearchRankingHandlers.test.ts
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import prisma from "@/lib/prisma";
import {
  handleSearchRankingGet,
  handleSearchRankingMutation,
  isSearchRankingAdmin,
} from "./adminSearchRankingHandlers";
import type { AuthActor } from "@/lib/auth/safeUser";

const cleanupUserIds: string[] = [];

async function createTestUser(role: "ADMIN" | "MODERATOR" | "USER"): Promise<AuthActor> {
  const user = await prisma.user.create({
    data: { email: `test-search-ranking-${randomUUID()}@test.local`, role },
  });
  cleanupUserIds.push(user.id);
  return { id: user.id, role: user.role };
}

async function snapshotSettings() {
  return prisma.searchRankingSettings.findFirst({ orderBy: { updatedAt: "desc" } });
}

async function main() {
  console.log("Starting admin search-ranking handlers tests...");
  try {
    const admin = await createTestUser("ADMIN");
    const moderator = await createTestUser("MODERATOR");
    const plainUser = await createTestUser("USER");

    // --- permissions: this route is ADMIN-only, stricter than /api/admin/ranking ---
    assert.equal(isSearchRankingAdmin(null), false);
    assert.equal(isSearchRankingAdmin(plainUser), false);
    assert.equal(isSearchRankingAdmin(moderator), false, "MODERATOR is not sufficient for this route");
    assert.equal(isSearchRankingAdmin(admin), true);

    assert.equal((await handleSearchRankingGet(null)).status, 401);
    assert.equal((await handleSearchRankingGet(plainUser)).status, 401);
    assert.equal((await handleSearchRankingGet(moderator)).status, 401);

    assert.equal(handleSearchRankingMutation(null).status, 401);
    assert.equal(handleSearchRankingMutation(plainUser).status, 401);
    assert.equal(handleSearchRankingMutation(moderator).status, 401);

    // --- GET still works and reflects real DB state ---
    {
      const before = await snapshotSettings();
      const res = await handleSearchRankingGet(admin);
      assert.equal(res.status, 200);
      const body = res.body as { success: boolean; data: { settings: { id: string; nearbyBoost: number } } };
      assert.equal(body.success, true);
      const after = await snapshotSettings();
      assert.equal(body.data.settings.id, after?.id);
      assert.equal(body.data.settings.nearbyBoost, after?.nearbyBoost);
      // GET must not have mutated any existing row's values (it may create a
      // default row only when the table was empty, which is pre-existing
      // behavior — assert idempotency instead of reaching into prod data).
      if (before) {
        assert.deepEqual(after, before, "GET must not mutate an existing settings row");
      }
    }

    // --- PATCH/POST are locked 403 for an authorized admin, and never touch the DB ---
    {
      const before = await snapshotSettings();
      const res = handleSearchRankingMutation(admin);
      assert.equal(res.status, 403);
      assert.match((res.body as { error: string }).error, /не влияют на production ranking/);
      const after = await snapshotSettings();
      assert.deepEqual(after, before, "SearchRankingSettings must be untouched by a locked mutation attempt");
    }

    console.log("admin search-ranking handlers tests: OK");
  } finally {
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
