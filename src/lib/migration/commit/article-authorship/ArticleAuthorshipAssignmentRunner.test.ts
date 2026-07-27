import assert from "node:assert/strict";
import test from "node:test";

import {
  ArticleAuthorshipAssignmentRunner,
  USER_575_EXPECTED_ARTICLE_IDS,
  type ArticleAuthorshipAssignmentPrismaClient,
} from "./ArticleAuthorshipAssignmentRunner";

function fixture(input: {
  authors?: Record<string, string | null>;
  casCounts?: Record<string, number>;
  duplicateFor?: string;
  targetOverride?: { sourceRecordKey: string; articleId: string };
}) {
  const articleIds: Record<string, string> = USER_575_EXPECTED_ARTICLE_IDS;
  const authors: Record<string, string | null> = {
    [USER_575_EXPECTED_ARTICLE_IDS["wordpress-db:post:56250"]]: null,
    [USER_575_EXPECTED_ARTICLE_IDS["wordpress-db:post:57731"]]: null,
    ...(input.authors ?? {}),
  };
  const updates: string[] = [];
  const client = {
    migrationLineage: {
      findMany: async ({ where }: { where: { sourceRecordKey: string } }) => {
        if (where.sourceRecordKey === "wordpress-db:user:575") return [{ targetId: "user-575" }];
        const targetId =
          input.targetOverride?.sourceRecordKey === where.sourceRecordKey
            ? input.targetOverride.articleId
            : articleIds[where.sourceRecordKey];
        const rows = [{ targetType: "ARTICLE", targetId, isActive: true }];
        if (input.duplicateFor === where.sourceRecordKey) rows.push({ ...rows[0] });
        return rows;
      },
    },
    user: {
      findUnique: async () => ({ id: "user-575", deletedAt: null }),
    },
    article: {
      findUnique: async ({ where }: { where: { id: string } }) => ({
        id: where.id,
        authorUserId: authors[where.id],
      }),
      updateMany: async ({ where, data }: { where: { id: string }; data: { authorUserId: string } }) => {
        updates.push(where.id);
        const count = input.casCounts?.[where.id] ?? 1;
        if (count === 1) authors[where.id] = data.authorUserId;
        return { count };
      },
    },
  };
  const prisma = {
    ...client,
    $transaction: async <T>(fn: (tx: typeof client) => Promise<T>) => fn(client),
  } as unknown as ArticleAuthorshipAssignmentPrismaClient;
  return { prisma, updates, authors };
}

test("assigns both fixed-scope Articles sequentially using CAS", async () => {
  const { prisma, updates, authors } = fixture({});
  const results = await new ArticleAuthorshipAssignmentRunner(prisma).executeBatch();
  assert.deepEqual(results.map((result) => result.action), ["ASSIGNED", "ASSIGNED"]);
  assert.deepEqual(updates, Object.values(USER_575_EXPECTED_ARTICLE_IDS));
  assert.equal(authors[USER_575_EXPECTED_ARTICLE_IDS["wordpress-db:post:56250"]], "user-575");
  assert.equal(authors[USER_575_EXPECTED_ARTICLE_IDS["wordpress-db:post:57731"]], "user-575");
});

test("rerun is ALREADY_SATISFIED with zero updates", async () => {
  const { prisma, updates } = fixture({
    authors: {
      [USER_575_EXPECTED_ARTICLE_IDS["wordpress-db:post:56250"]]: "user-575",
      [USER_575_EXPECTED_ARTICLE_IDS["wordpress-db:post:57731"]]: "user-575",
    },
  });
  const results = await new ArticleAuthorshipAssignmentRunner(prisma).executeBatch();
  assert.deepEqual(results.map((result) => result.action), ["ALREADY_SATISFIED", "ALREADY_SATISFIED"]);
  assert.deepEqual(updates, []);
});

test("stops before the second Article when the first CAS fails", async () => {
  const firstArticleId = USER_575_EXPECTED_ARTICLE_IDS["wordpress-db:post:56250"];
  const { prisma, updates } = fixture({ casCounts: { [firstArticleId]: 0 } });
  await assert.rejects(
    () => new ArticleAuthorshipAssignmentRunner(prisma).executeBatch(),
    /AUTHORSHIP_CAS_MISMATCH/,
  );
  assert.deepEqual(updates, [firstArticleId]);
});

test("blocks duplicate active ARTICLE lineage before any update", async () => {
  const { prisma, updates } = fixture({ duplicateFor: "wordpress-db:post:56250" });
  await assert.rejects(
    () => new ArticleAuthorshipAssignmentRunner(prisma).executeBatch(),
    /AUTHORSHIP_ARTICLE_LINEAGE_MISMATCH/,
  );
  assert.deepEqual(updates, []);
});

test("blocks a lineage target that differs from the exact proven Article ID", async () => {
  const { prisma, updates } = fixture({
    targetOverride: { sourceRecordKey: "wordpress-db:post:56250", articleId: "unexpected-article" },
  });
  await assert.rejects(
    () => new ArticleAuthorshipAssignmentRunner(prisma).executeBatch(),
    /AUTHORSHIP_ARTICLE_TARGET_ID_MISMATCH/,
  );
  assert.deepEqual(updates, []);
});
