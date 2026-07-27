import assert from "node:assert/strict";
import test from "node:test";

import {
  ArticleAuthorshipAssignmentRunner,
  type ArticleAuthorshipAssignmentPrismaClient,
} from "./ArticleAuthorshipAssignmentRunner";

function fixture(input: {
  authors?: Record<string, string | null>;
  casCounts?: Record<string, number>;
  duplicateFor?: string;
}) {
  const articleIds: Record<string, string> = {
    "wordpress-db:post:56250": "article-56250",
    "wordpress-db:post:57731": "article-57731",
  };
  const authors: Record<string, string | null> = {
    "article-56250": null,
    "article-57731": null,
    ...(input.authors ?? {}),
  };
  const updates: string[] = [];
  const client = {
    migrationLineage: {
      findMany: async ({ where }: { where: { sourceRecordKey: string } }) => {
        if (where.sourceRecordKey === "wordpress-db:user:575") return [{ targetId: "user-575" }];
        const rows = [{ targetType: "ARTICLE", targetId: articleIds[where.sourceRecordKey], isActive: true }];
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
  assert.deepEqual(updates, ["article-56250", "article-57731"]);
  assert.equal(authors["article-56250"], "user-575");
  assert.equal(authors["article-57731"], "user-575");
});

test("rerun is ALREADY_SATISFIED with zero updates", async () => {
  const { prisma, updates } = fixture({
    authors: { "article-56250": "user-575", "article-57731": "user-575" },
  });
  const results = await new ArticleAuthorshipAssignmentRunner(prisma).executeBatch();
  assert.deepEqual(results.map((result) => result.action), ["ALREADY_SATISFIED", "ALREADY_SATISFIED"]);
  assert.deepEqual(updates, []);
});

test("stops before the second Article when the first CAS fails", async () => {
  const { prisma, updates } = fixture({ casCounts: { "article-56250": 0 } });
  await assert.rejects(
    () => new ArticleAuthorshipAssignmentRunner(prisma).executeBatch(),
    /AUTHORSHIP_CAS_MISMATCH/,
  );
  assert.deepEqual(updates, ["article-56250"]);
});

test("blocks duplicate active ARTICLE lineage before any update", async () => {
  const { prisma, updates } = fixture({ duplicateFor: "wordpress-db:post:56250" });
  await assert.rejects(
    () => new ArticleAuthorshipAssignmentRunner(prisma).executeBatch(),
    /AUTHORSHIP_ARTICLE_LINEAGE_MISMATCH/,
  );
  assert.deepEqual(updates, []);
});
