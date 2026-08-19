import type { MigrationWarning, NormalizedRecord } from "../../types";
import {
  appendMissingStoryImages,
  extractInlineImageAttachmentIdsFromHtml,
  extractStoryAttachmentIds,
  hasMeaningfulElementorMeta,
  hasWebStoryMeta,
  linearizeArticleSourceHtml,
} from "./articleSourceRepresentation";
import type { WordPressArticleBundle, WordPressTermRow } from "./types";

const SOURCE_ENTITY_TYPE = "wordpress-db:post";

/** Raw taxonomy reference (category or tag) — no mapping to any mamaGo taxonomy/enum happens here. */
export interface NormalizedArticleSourceTerm {
  termId: number;
  taxonomy: string;
  name: string;
  slug: string;
}

/**
 * Everything this normalizer is confident about extracting verbatim from a
 * `WordPressArticleBundle`. Empty/fake Elementor leftover keys are ignored.
 * Real Elementor is flagged but `post_content` is still linearized for the
 * existing HTML → contentJson pipeline. Web Story AMP chrome is linearized
 * into ordinary HTML; story UI is not reproduced. Nothing here is
 * downloaded, resolved, or committed.
 */
export interface NormalizedArticleCandidate {
  title: string;
  slug: string;
  content: string;
  excerpt: string;
  status: string;
  publishedAt: string;
  modifiedAt: string;
  seo: {
    title: string | null;
    description: string | null;
    focusKeyword: string | null;
    canonicalUrl: string | null;
    robots: string | null;
    ogTitle: string | null;
    ogDescription: string | null;
  };
  featuredImageAttachmentId: number | null;
  /** Attachment ids parsed from `wp-image-<id>` classes inside `post_content`. Nothing is downloaded. */
  inlineImageAttachmentIds: readonly number[];
  /** `_wp_old_slug` values, kept as an array since a post can accumulate several over time. */
  oldSlugs: readonly string[];
  /** True only when `_elementor_data` contains a real builder tree, not an empty leftover key. */
  hasElementorContent: boolean;
  /** True when Web Story postmeta is non-empty. Content is linearized into `content`, not left as AMP UI. */
  hasWebStoryContent: boolean;
  /** Raw taxonomy terms (categories and tags alike, distinguished by `taxonomy`). No mapping applied. */
  sourceTerms: readonly NormalizedArticleSourceTerm[];
  /** Full postmeta passthrough so nothing not explicitly lifted above is silently dropped. */
  rawMeta: Readonly<Record<string, readonly string[]>>;
}

function firstMetaValue(
  postMeta: WordPressArticleBundle["postMeta"],
  key: string,
): string | null {
  return postMeta[key]?.[0] ?? null;
}

function parseAttachmentId(value: string | null): number | null {
  if (value === null || value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function toSourceTerm(term: WordPressTermRow): NormalizedArticleSourceTerm {
  return { termId: term.term_id, taxonomy: term.taxonomy, name: term.name, slug: term.slug };
}

export function normalizeArticle(bundle: WordPressArticleBundle): NormalizedRecord {
  const { post, postMeta, terms } = bundle;
  const sourceRecordKey = `${SOURCE_ENTITY_TYPE}:${post.ID}`;
  const warnings: MigrationWarning[] = [];

  const hasElementorContent = hasMeaningfulElementorMeta(postMeta);
  if (hasElementorContent) {
    warnings.push({
      code: "ARTICLE_ELEMENTOR_CONTENT",
      message: "Post has a non-empty Elementor builder payload. post_content is used when it is a usable linear representation.",
      severity: "WARNING",
      sourceRecordKey,
    });
  }

  const hasWebStoryContent = hasWebStoryMeta(postMeta);
  if (hasWebStoryContent) {
    warnings.push({
      code: "ARTICLE_WEB_STORY",
      message: "Post has Web Story metadata. AMP chrome is linearized into ordinary HTML; story UI is not reproduced.",
      severity: "WARNING",
      sourceRecordKey,
    });
  }

  const featuredImageAttachmentId = parseAttachmentId(firstMetaValue(postMeta, "_thumbnail_id"));
  if (featuredImageAttachmentId === null) {
    warnings.push({
      code: "ARTICLE_MISSING_FEATURED_IMAGE",
      message: "No _thumbnail_id postmeta for this post.",
      severity: "WARNING",
      sourceRecordKey,
    });
  }

  const storyAttachmentIds = hasWebStoryContent ? extractStoryAttachmentIds(postMeta) : [];
  const linearizedContent = appendMissingStoryImages(
    linearizeArticleSourceHtml(post.post_content ?? ""),
    storyAttachmentIds,
  );
  const inlineImageAttachmentIds = extractInlineImageAttachmentIdsFromHtml(linearizedContent);
  const oldSlugs = postMeta["_wp_old_slug"] ?? [];

  const mediaRefs = [
    ...(featuredImageAttachmentId !== null ? [String(featuredImageAttachmentId)] : []),
    ...inlineImageAttachmentIds
      .filter((id) => id !== featuredImageAttachmentId)
      .map((id) => String(id)),
  ];
  const relationRefs = terms.map((term) => `term:${term.taxonomy}:${term.slug}`);

  const normalizedPayload: NormalizedArticleCandidate = {
    title: post.post_title,
    slug: post.post_name,
    content: linearizedContent,
    excerpt: post.post_excerpt,
    status: post.post_status,
    publishedAt: post.post_date,
    modifiedAt: post.post_modified,
    seo: {
      title: firstMetaValue(postMeta, "rank_math_title"),
      description: firstMetaValue(postMeta, "rank_math_description"),
      focusKeyword: firstMetaValue(postMeta, "rank_math_focus_keyword"),
      canonicalUrl: firstMetaValue(postMeta, "rank_math_canonical_url"),
      robots: firstMetaValue(postMeta, "rank_math_robots"),
      ogTitle: firstMetaValue(postMeta, "rank_math_facebook_title"),
      ogDescription: firstMetaValue(postMeta, "rank_math_facebook_description"),
    },
    featuredImageAttachmentId,
    inlineImageAttachmentIds,
    oldSlugs,
    hasElementorContent,
    hasWebStoryContent,
    sourceTerms: terms.map(toSourceTerm),
    rawMeta: postMeta,
  };

  return {
    sourceRecordKey,
    sourceEntityType: SOURCE_ENTITY_TYPE,
    targetTypeHint: "ARTICLE",
    normalizedPayload,
    mediaRefs,
    relationRefs,
    warnings,
  };
}
