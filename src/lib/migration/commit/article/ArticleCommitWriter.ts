import type { Article, Prisma, PrismaClient } from "@prisma/client";

import type { ArticleCreateDraft } from "./buildArticleCreateDraft";

/**
 * The narrowest slice of `PrismaClient` this writer needs — just
 * `article.create`, typed via Prisma's own generated signature. No
 * `articleSlugHistory`, no `mediaAsset`, no `discoveryTag`,
 * `migrationLineage`/`migrationRecord` delegates — they aren't present on
 * this type, so this writer cannot call them even by mistake.
 */
export interface ArticleCommitWriterPrismaClient {
  article: Pick<PrismaClient["article"], "create" | "update">;
}

export interface ArticleCommitSuccess {
  ok: true;
  articleId: string;
}

export interface ArticleCommitFailure {
  ok: false;
  errorCode: string;
  errorMessage: string;
}

export type ArticleCommitResult = ArticleCommitSuccess | ArticleCommitFailure;

function assertDraftIsUsable(draft: ArticleCreateDraft): void {
  // Defense-in-depth only — `buildArticleCreateDraft` (PR21) is the real
  // gatekeeper. This writer never repeats that decision logic, it just
  // refuses to silently create a broken row if handed something invalid.
  if (!draft.title?.trim()) {
    throw new Error("ArticleCreateDraft.title is required.");
  }
}

function parseArticlePublishedAt(value: string): Date {
  const raw = value.trim();
  const mysqlDateTimeMatch = /^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2})$/.exec(raw);
  const normalized = mysqlDateTimeMatch ? `${mysqlDateTimeMatch[1]}T${mysqlDateTimeMatch[2]}.000Z` : raw;
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`ArticleCreateDraft.publishedAt is not a valid DateTime: "${value}".`);
  }
  return date;
}

function buildArticleCreateData(draft: ArticleCreateDraft): Prisma.ArticleUncheckedCreateInput {
  return {
    title: draft.title,
    slug: draft.slug,
    excerpt: draft.excerpt,
    publishedAt: parseArticlePublishedAt(draft.publishedAt),
    status: draft.status,
    seoTitle: draft.seoTitle,
    seoDescription: draft.seoDescription,
    seoCanonicalUrl: draft.seoCanonicalUrl,
    seoRobots: draft.seoRobots,
    seoOgTitle: draft.seoOgTitle,
    seoOgDescription: draft.seoOgDescription,
    authorUserId: draft.authorUserId,
    authorLabel: draft.authorLabel,
    // `ArticleContentPayload` is already a plain, JSON-serializable
    // object — this cast only satisfies Prisma's generated
    // `InputJsonValue` index-signature requirement, it doesn't
    // change what's actually written.
    contentJson: draft.contentJson as unknown as Prisma.InputJsonValue,
  };
}

function buildArticleUpdateData(draft: ArticleCreateDraft): Prisma.ArticleUncheckedUpdateInput {
  return {
    excerpt: draft.excerpt,
    contentJson: draft.contentJson as unknown as Prisma.InputJsonValue,
  };
}

/**
 * The first real Article entity writer: `ArticleCreateDraft` -> one
 * `Article` row via one `prisma.article.create()` call. It makes no
 * decisions — slug, SEO, content conversion, everything already went
 * through `buildArticleCreateDraft` (PR21) before reaching here. No
 * `ArticleSlugHistory`, no media, no category/tags/related place, no
 * lineage, no `MigrationRecord`, no rollback — that's later PRs.
 *
 * Unlike `PlaceCommitWriter`/`EventCommitWriter`, which let an infra-level
 * `prisma.*.create()` failure propagate as a raw exception (the
 * orchestrator layer catches it), this writer catches its own
 * `prisma.article.create()` failure and returns a typed
 * `ArticleCommitFailure` instead — a deliberate, explicitly requested
 * deviation for PR22, not an oversight. Defensive input validation
 * (`assertDraftIsUsable`) still throws, since an invalid draft reaching
 * this writer is a programmer error, not an "expected create() failure."
 */
export class ArticleCommitWriter {
  constructor(private readonly prisma: ArticleCommitWriterPrismaClient) {}

  async createArticleFromDraft(draft: ArticleCreateDraft): Promise<ArticleCommitResult> {
    assertDraftIsUsable(draft);

    try {
      const article: Article = await this.prisma.article.create({
        data: buildArticleCreateData(draft),
      });

      return { ok: true, articleId: article.id };
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      return { ok: false, errorCode: "ARTICLE_CREATE_FAILED", errorMessage: err.message };
    }
  }

  async updateArticleFromDraft(articleId: string, draft: ArticleCreateDraft): Promise<ArticleCommitResult> {
    assertDraftIsUsable(draft);
    if (!articleId.trim()) {
      throw new Error("articleId is required for Article update.");
    }

    try {
      const article: Article = await this.prisma.article.update({
        where: { id: articleId },
        // Keep slug/title identity stable on reprocess; only refresh content fields.
        data: buildArticleUpdateData(draft),
      });

      return { ok: true, articleId: article.id };
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      return { ok: false, errorCode: "ARTICLE_UPDATE_FAILED", errorMessage: err.message };
    }
  }
}
