import type { ArticleContentPayload } from "@/lib/publications/articleMvp";

import type { NormalizedArticleCandidate } from "../../adapters/wordpress-db/normalizeArticle";
import {
  normalizeMigrationContent,
  normalizedContentToArticleContentJson,
  type ContentNormalizationWarningCode,
} from "../../content";

export type { NormalizedArticleCandidate };

/**
 * Minimal and manual, on purpose: nothing on `Article` is strictly
 * required beyond `title` (verified against `prisma/schema.prisma` —
 * `authorUserId` is nullable, unlike `Place.createdByUserId`/
 * `Activity.ownerUserId`). `authorUserId`/`authorLabel` are the only two
 * fields with no candidate-derivable source at all, so they're the only
 * manual inputs this MVP needs.
 */
export interface ArticleCommitContext {
  authorUserId?: string | null;
  authorLabel?: string | null;
}

export type ArticleCommitBlockReasonCode =
  | "MISSING_TITLE"
  | "ELEMENTOR_CONTENT_NOT_REPRESENTABLE"
  | "MISSING_CONTENT";

export interface ArticleCommitBlockReason {
  code: ArticleCommitBlockReasonCode;
  message: string;
  details?: Record<string, unknown>;
}

export type ArticleCommitWarningCode =
  | "CONTENT_NORMALIZED_WITH_LIMITATIONS"
  | ContentNormalizationWarningCode;

export interface ArticleCommitWarning {
  code: ArticleCommitWarningCode;
  message: string;
  details?: Record<string, unknown>;
}

/**
 * Only fields confirmed to exist on the real `Article` model are present
 * here. Two were checked and explicitly rejected during PR21:
 * `candidate.seo.focusKeyword` — `Article` has no matching SEO field at
 * all (only `seoTitle/Description/H1/CanonicalUrl/OgTitle/OgDescription/
 * OgImage/Robots/ImageId` — no "focus keyword" column); and `modifiedAt`
 * — `Article.updatedAt` is Prisma-`@updatedAt`-managed, not a real
 * "set this on create" input field the way `publishedAt` is, so it's
 * left out rather than fighting Prisma's own timestamp management.
 */
export interface ArticleCreateDraft {
  title: string;
  slug: string | null;
  excerpt: string | null;
  /** Raw WP date string, unconverted — turning this into a real `Date`/ISO value is a writer-stage concern, not this pure builder's. */
  publishedAt: string;
  status: "PENDING";
  seoTitle: string | null;
  seoDescription: string | null;
  seoCanonicalUrl: string | null;
  seoRobots: string | null;
  seoOgTitle: string | null;
  seoOgDescription: string | null;
  authorUserId: string | null;
  authorLabel: string | null;
  /** Native Article MVP content produced by the universal Phoenix content normalization pipeline. */
  contentJson: ArticleContentPayload;
}

export type ArticleCreateDraftResult =
  | { ok: true; draft: ArticleCreateDraft; warnings: readonly ArticleCommitWarning[] }
  | { ok: false; reasons: readonly ArticleCommitBlockReason[] };

export interface BuildArticleCreateDraftInput {
  candidate: NormalizedArticleCandidate;
  context: ArticleCommitContext;
}

/**
 * Pure function: `NormalizedArticleCandidate` + manual `ArticleCommitContext`
 * -> `ArticleCreateDraft`, or a list of block reasons. Never reads/writes a
 * database. Text/HTML cleanup and structure detection is delegated to the
 * universal Phoenix `ContentNormalizationPipeline`, not to WordPress-specific
 * string cleanup in this builder.
 *
 * Empty/fake Elementor leftover keys are not a block — the normalizer
 * already treats those as `hasElementorContent: false`. Real Elementor
 * still uses this same HTML → contentJson pipeline when `post_content`
 * yields usable plain text. Web Stories are linearized upstream into
 * ordinary HTML; AMP UI is not reproduced. A real Elementor tree with
 * no usable linear HTML is blocked as ELEMENTOR_CONTENT_NOT_REPRESENTABLE
 * rather than inventing a builder parser.
 *
 * No media, category, tags, related place, city/geo, or slug history are
 * ever produced here — media is applied later by ArticleFullMediaSyncer.
 */
export function buildArticleCreateDraft(input: BuildArticleCreateDraftInput): ArticleCreateDraftResult {
  const { candidate, context } = input;
  const reasons: ArticleCommitBlockReason[] = [];

  if (!candidate.title?.trim()) {
    reasons.push({ code: "MISSING_TITLE", message: "NormalizedArticleCandidate.title is empty." });
  }

  const normalizedContent = normalizeMigrationContent({
    sourceKind: "wordpress",
    raw: candidate.content ?? "",
  });
  const hasUsablePostContent = Boolean(normalizedContent.plainText);
  if (candidate.hasElementorContent && !hasUsablePostContent) {
    reasons.push({
      code: "ELEMENTOR_CONTENT_NOT_REPRESENTABLE",
      message:
        "Post has a real Elementor builder payload and candidate.content does not normalize to usable plain text — refusing to invent an Elementor layout parser.",
    });
  } else if (!hasUsablePostContent) {
    reasons.push({
      code: "MISSING_CONTENT",
      message: "candidate.content normalizes to empty plain text — refusing to write an Article with no content at all.",
    });
  }

  if (reasons.length > 0) {
    return { ok: false, reasons };
  }

  const normalizedArticleContent = normalizedContentToArticleContentJson(normalizedContent);
  const contentJson: ArticleContentPayload = normalizedArticleContent.contentJson;

  const draft: ArticleCreateDraft = {
    title: candidate.title,
    slug: candidate.slug?.trim() || null,
    excerpt: candidate.excerpt?.trim() || null,
    publishedAt: candidate.publishedAt,
    status: "PENDING",
    seoTitle: candidate.seo.title,
    seoDescription: candidate.seo.description,
    seoCanonicalUrl: candidate.seo.canonicalUrl,
    seoRobots: candidate.seo.robots,
    seoOgTitle: candidate.seo.ogTitle,
    seoOgDescription: candidate.seo.ogDescription,
    authorUserId: context.authorUserId ?? null,
    authorLabel: context.authorLabel ?? null,
    contentJson,
  };

  return {
    ok: true,
    draft,
    warnings: [
      {
        code: "CONTENT_NORMALIZED_WITH_LIMITATIONS",
        message:
          "contentJson was produced by the universal Phoenix content normalization pipeline. Review remaining warnings for MVP down-conversions.",
        details: {
          plainTextLength: normalizedContent.plainText.length,
          normalizedBlockCount: normalizedContent.blocks.length,
          contentJsonBlockCount: contentJson.blocks.length,
        },
      },
      ...normalizedArticleContent.warnings,
    ],
  };
}
