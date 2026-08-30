/**
 * Idempotent PLAN/APPLY repair for ArticleSlugHistory rows that back migrated
 * CITY article legacy slugs.
 *
 * Usage:
 *   PLAN:  set -a; source .env; set +a; npx tsx scripts/repair-migrated-article-slug-history.ts
 *   APPLY: set -a; source .env; set +a; npx tsx scripts/repair-migrated-article-slug-history.ts --apply
 *
 * PROD writes are intentionally manual and out-of-band for Phase 1.
 */
import { PrismaClient } from "@prisma/client";
import {
  cityBlogPath,
  MIGRATED_ARTICLE_SLUG_RECOVERIES,
} from "../src/lib/seo/migratedArticleSlugRecovery";

const prisma = new PrismaClient();
const apply = process.argv.includes("--apply");

type PlanRow = {
  articleId: string;
  cityId: string | null;
  oldSlug: string;
  currentSlug: string;
  status: "create" | "exists" | "conflict";
  reason?: string;
};

function legacySlugFromSource(sourcePath: string): string {
  const segments = sourcePath.split("/").filter(Boolean);
  return segments.at(-1) ?? sourcePath;
}

async function main() {
  const plan: PlanRow[] = [];

  for (const recovery of MIGRATED_ARTICLE_SLUG_RECOVERIES) {
    const article = await prisma.article.findUnique({
      where: { id: recovery.articleId },
      select: { id: true, slug: true, cityId: true, status: true },
    });
    if (!article?.slug) {
      plan.push({
        articleId: recovery.articleId,
        cityId: null,
        oldSlug: legacySlugFromSource(recovery.legacySourcePath),
        currentSlug: recovery.currentProdSlug,
        status: "conflict",
        reason: "article missing or slug empty",
      });
      continue;
    }
    if (article.slug !== recovery.currentProdSlug) {
      plan.push({
        articleId: recovery.articleId,
        cityId: article.cityId,
        oldSlug: legacySlugFromSource(recovery.legacySourcePath),
        currentSlug: recovery.currentProdSlug,
        status: "conflict",
        reason: `article slug drift: db=${article.slug}`,
      });
      continue;
    }

    const oldSlug = legacySlugFromSource(recovery.legacySourcePath);
    if (oldSlug === article.slug) {
      plan.push({
        articleId: article.id,
        cityId: article.cityId,
        oldSlug,
        currentSlug: article.slug,
        status: "exists",
        reason: "legacy slug already equals current slug",
      });
      continue;
    }

    const existing = await prisma.articleSlugHistory.findFirst({
      where: { slug: oldSlug, cityId: article.cityId },
      select: { articleId: true },
    });
    if (existing) {
      plan.push({
        articleId: article.id,
        cityId: article.cityId,
        oldSlug,
        currentSlug: article.slug,
        status: existing.articleId === article.id ? "exists" : "conflict",
        reason:
          existing.articleId === article.id
            ? "history row already present"
            : `slug reserved by article ${existing.articleId}`,
      });
      continue;
    }

    plan.push({
      articleId: article.id,
      cityId: article.cityId,
      oldSlug,
      currentSlug: article.slug,
      status: "create",
    });
  }

  console.log("=== MIGRATED ARTICLE SLUG HISTORY REPAIR PLAN ===");
  for (const row of plan) {
    console.log(
      JSON.stringify({
        ...row,
        oldPath: row.cityId ? cityBlogPath(row.oldSlug) : null,
        currentPath: row.cityId ? cityBlogPath(row.currentSlug) : null,
      }),
    );
  }

  const summary = {
    total: plan.length,
    create: plan.filter((row) => row.status === "create").length,
    exists: plan.filter((row) => row.status === "exists").length,
    conflict: plan.filter((row) => row.status === "conflict").length,
    mode: apply ? "apply" : "plan",
  };
  console.log("=== SUMMARY ===");
  console.log(JSON.stringify(summary, null, 2));

  if (!apply) return;
  if (summary.conflict > 0) {
    throw new Error("Refusing to apply with conflicts present");
  }

  for (const row of plan.filter((entry) => entry.status === "create")) {
    await prisma.articleSlugHistory.create({
      data: {
        articleId: row.articleId,
        slug: row.oldSlug,
        cityId: row.cityId,
      },
    });
  }
}

main()
  .catch((error) => {
    console.error("[repair-migrated-article-slug-history]", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
