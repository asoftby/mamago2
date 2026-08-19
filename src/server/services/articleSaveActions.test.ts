/**
 * Integration tests for Task 6 (Article Actions) Idea/Plan service support:
 * addArticleIdea/removeArticleIdea/hasArticleIdea/hasArticleIdeasBatch
 * (src/server/services/idea.service.ts) and addArticlePlanItem/
 * listArticlePlanItemsBatch/removePlanItem (src/server/services/plan.service.ts).
 * Self-generated fixtures (2 users + 1 article), cleaned up in a finally
 * block. Exercises the real functions against the local dev DB.
 *
 * Run: set -a; source .env; set +a; npx tsx src/server/services/articleSaveActions.test.ts
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import {
  addArticleIdea,
  hasArticleIdea,
  hasArticleIdeasBatch,
  removeArticleIdea,
} from "@/server/services/idea.service";
import {
  addArticlePlanItem,
  listArticlePlanItemsBatch,
  removePlanItem,
} from "@/server/services/plan.service";

async function main() {
  const marker = randomUUID();
  const createdUserIds: string[] = [];
  const createdArticleIds: string[] = [];

  async function createUser(label: string) {
    const user = await prisma.user.create({
      data: { email: `article-save-${label}-${marker}@example.invalid` },
      select: { id: true },
    });
    createdUserIds.push(user.id);
    return user.id;
  }

  async function createArticle(title: string) {
    const article = await prisma.article.create({
      data: { title: `${title} ${marker}` },
      select: { id: true },
    });
    createdArticleIds.push(article.id);
    return article.id;
  }

  try {
    const userA = await createUser("user-a");
    const userB = await createUser("user-b");
    const articleX = await createArticle("Article X");
    const articleY = await createArticle("Article Y");

    // ── Ideas: create, idempotent, cross-user isolation, remove ──
    assert.equal(await hasArticleIdea(userA, articleX), false, "starts unsaved");

    await addArticleIdea(userA, articleX);
    assert.equal(await hasArticleIdea(userA, articleX), true, "saved after add");

    // Idempotent: adding again must not throw or create a duplicate row.
    await addArticleIdea(userA, articleX);
    const ideaRows = await prisma.articleIdea.findMany({
      where: { userId: userA, articleId: articleX },
    });
    assert.equal(ideaRows.length, 1, "duplicate add must not create a second row");

    // Cross-user isolation: userB must not see userA's idea.
    assert.equal(await hasArticleIdea(userB, articleX), false, "cross-user isolation");

    await removeArticleIdea(userA, articleX);
    assert.equal(await hasArticleIdea(userA, articleX), false, "removed");

    // Idempotent remove: removing again must not throw.
    await removeArticleIdea(userA, articleX);

    // ── Batch idea check ──
    await addArticleIdea(userA, articleX);
    await addArticleIdea(userA, articleY);
    const batch = await hasArticleIdeasBatch(userA, [articleX, articleY, "nonexistent-id"]);
    assert.equal(batch.size, 2);
    assert.ok(batch.has(articleX));
    assert.ok(batch.has(articleY));
    assert.equal(batch.has("nonexistent-id"), false);
    assert.equal((await hasArticleIdeasBatch(userA, [])).size, 0, "empty input short-circuits");

    // ── Plan: add, dedupe-by-user+article, remove ──
    const created = await addArticlePlanItem(userA, articleX, "2026-09-15");
    assert.ok(created.id);

    // Second add for the same user+article on a different date must UPDATE
    // the existing row, not create a second plan item (dedup, mirrors
    // addPlacePlanItem's contract).
    const updated = await addArticlePlanItem(userA, articleX, "2026-09-20");
    assert.equal(updated.id, created.id, "same user+article must dedupe to one plan item");
    const planRow = await prisma.planItem.findUnique({ where: { id: created.id } });
    assert.equal(planRow?.date, "2026-09-20");
    assert.equal(planRow?.articleId, articleX);
    assert.equal(planRow?.activityId, null, "must clear competing entity fields");
    assert.equal(planRow?.placeId, null, "must clear competing entity fields");

    // Cross-user isolation for plan.
    const planItemsForUserB = await prisma.planItem.findMany({
      where: { userId: userB, articleId: articleX },
    });
    assert.equal(planItemsForUserB.length, 0);

    // ── Batch plan listing ──
    const batchPlanItems = await listArticlePlanItemsBatch(userA, [articleX, articleY]);
    assert.equal(batchPlanItems.length, 1, "only articleX has a plan item");
    assert.equal(batchPlanItems[0]!.articleId, articleX);
    assert.equal(
      (await listArticlePlanItemsBatch(userA, [])).length,
      0,
      "empty input short-circuits",
    );

    // ── Remove (ownership-checked) ──
    await removePlanItem(userB, created.id); // wrong owner — must be a no-op
    assert.ok(
      await prisma.planItem.findUnique({ where: { id: created.id } }),
      "wrong-owner remove must not delete the row",
    );

    await removePlanItem(userA, created.id);
    assert.equal(
      await prisma.planItem.findUnique({ where: { id: created.id } }),
      null,
      "correct-owner remove deletes the row",
    );

    // ── Invalid entity: article not found ──
    await assert.rejects(
      () => addArticlePlanItem(userA, "does-not-exist", "2026-09-15"),
      /Article not found/,
    );

    console.log("articleSaveActions service tests: OK");
  } finally {
    await prisma.planItem.deleteMany({ where: { userId: { in: createdUserIds } } });
    await prisma.articleIdea.deleteMany({ where: { userId: { in: createdUserIds } } });
    await prisma.article.deleteMany({ where: { id: { in: createdArticleIds } } });
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
