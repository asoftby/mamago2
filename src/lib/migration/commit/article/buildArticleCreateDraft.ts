import type { ArticleBlockMvp, ArticleContentPayload } from "@/lib/publications/articleMvp";

import type { NormalizedArticleCandidate } from "../../adapters/wordpress-db/normalizeArticle";

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
  | "ELEMENTOR_CONTENT_UNSUPPORTED"
  | "WEB_STORY_CONTENT_UNSUPPORTED"
  | "MISSING_CONTENT";

export interface ArticleCommitBlockReason {
  code: ArticleCommitBlockReasonCode;
  message: string;
  details?: Record<string, unknown>;
}

export type ArticleCommitWarningCode = "CONTENT_CONVERTED_LOSSY";

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
  /** Always `{ version: 1, blocks: [<one lossy text block>] }` in this MVP — see `CONTENT_CONVERTED_LOSSY`. */
  contentJson: ArticleContentPayload;
}

export type ArticleCreateDraftResult =
  | { ok: true; draft: ArticleCreateDraft; warnings: readonly ArticleCommitWarning[] }
  | { ok: false; reasons: readonly ArticleCommitBlockReason[] };

export interface BuildArticleCreateDraftInput {
  candidate: NormalizedArticleCandidate;
  context: ArticleCommitContext;
}

const ARTICLE_CONTENT_VERSION = 1 as const;
/** Fixed, not randomly generated — this MVP only ever produces exactly one block per article, so a stable id is simpler and keeps tests deterministic. */
const LOSSY_CONTENT_BLOCK_ID = "lossy-content-block";

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function buildLossyTextBlock(plainText: string): ArticleBlockMvp {
  return { id: LOSSY_CONTENT_BLOCK_ID, type: "text", text: plainText };
}

/**
 * Pure function: `NormalizedArticleCandidate` + manual `ArticleCommitContext`
 * -> `ArticleCreateDraft`, or a list of block reasons. Never reads/writes a
 * database. This is a deliberately hard-scoped MVP (see PR21 discussion):
 * it proves the pipeline down to a real `Article.create()`-shaped draft
 * without pretending to solve HTML/Elementor -> `contentJson` blocks
 * conversion. `contentJson` here is always exactly one lossy `text` block
 * built from `stripHtml(candidate.content)` — never a real block-by-block
 * conversion, always flagged with `CONTENT_CONVERTED_LOSSY`.
 *
 * Elementor and Web Story posts are blocked outright, not lossily
 * converted — `normalizeArticle()` already flags these
 * (`hasElementorContent`/`hasWebStoryContent`) precisely because their
 * content isn't linear HTML a plain-text strip could represent honestly.
 *
 * No media, category, tags, related place, city/geo, or slug history are
 * ever produced here — all deferred to later PRs, exactly like Place/Event
 * before it.
 */
export function buildArticleCreateDraft(input: BuildArticleCreateDraftInput): ArticleCreateDraftResult {
  const { candidate, context } = input;
  const reasons: ArticleCommitBlockReason[] = [];

  if (!candidate.title?.trim()) {
    reasons.push({ code: "MISSING_TITLE", message: "NormalizedArticleCandidate.title is empty." });
  }

  if (candidate.hasElementorContent) {
    reasons.push({
      code: "ELEMENTOR_CONTENT_UNSUPPORTED",
      message: "Post has Elementor content (_elementor_data/_elementor_template_type) — not representable as plain text without real loss.",
    });
  }

  if (candidate.hasWebStoryContent) {
    reasons.push({
      code: "WEB_STORY_CONTENT_UNSUPPORTED",
      message: "Post has Web Story content (wp-story-image/wp-story-cycle-image) — not representable as plain text without real loss.",
    });
  }

  const plainText = stripHtml(candidate.content ?? "");
  if (!plainText) {
    reasons.push({
      code: "MISSING_CONTENT",
      message: "candidate.content strips to empty plain text — refusing to write an Article with no content at all.",
    });
  }

  if (reasons.length > 0) {
    return { ok: false, reasons };
  }

  const contentJson: ArticleContentPayload = {
    version: ARTICLE_CONTENT_VERSION,
    blocks: [buildLossyTextBlock(plainText)],
  };

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
        code: "CONTENT_CONVERTED_LOSSY",
        message:
          "contentJson is a single lossy plain-text block, not a real HTML->blocks conversion. Needs manual editorial review before this article is considered a finished migration.",
        details: { plainTextLength: plainText.length },
      },
    ],
  };
}
