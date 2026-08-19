/**
 * A narrow, deliberately separate replay path for a single Article's
 * inline/cover media only — the normal Article CREATE/UPDATE commit path
 * (`ArticleCommitRunner`) never touches media at all today, by design (see
 * `buildArticleCreateDraft.ts`'s doc comment), and must keep not touching
 * it: this module never calls `ArticleCommitRunner`/`ArticleCommitWriter`,
 * never re-runs the migration planner, and never changes `Article.title`/
 * `slug`/`status`/`cityId`/`geoScope`/`categoryId`/`excerpt`/`publishedAt`/
 * SEO/author fields — only `contentJson` and `coverImageId`, and only via
 * `strictArticleMediaReplay.ts`'s atomic apply.
 *
 * Mirrors `eventMediaOnlyReprocess.ts`'s three-guard-layer shape:
 * - `validateArticleMediaReplayArgs()` — pure, synchronous, CLI-flag-only
 *   checks.
 * - `validateArticleMediaReplayRuntime()` — needs a live source fetch +
 *   lineage/target lookup; the hash-equality check is load-bearing (same
 *   reasoning as Event's): this replay is only ever allowed when the
 *   freshly computed canonical hash is byte-identical to the stored
 *   lineage hash. Also refuses a source that `buildArticleCreateDraft`
 *   cannot represent (empty body, or real Elementor without usable HTML).
 * - `strictArticleMediaReplay.ts`'s own preflight (allowlist, content
 *   divergence, attachment resolvability) — the actual media-level safety
 *   gate.
 */
import { CANONICAL_SOURCE_HASH_VERSION, hashArticleBundle } from "../adapters/wordpress-db/canonicalSourceHash";
import { normalizeArticle } from "../adapters/wordpress-db/normalizeArticle";
import { buildArticleCreateDraft } from "../commit/article/buildArticleCreateDraft";
import type { NormalizedArticleCandidate } from "../commit/article/buildArticleCreateDraft";
import type { WordPressArticleBundle } from "../adapters/wordpress-db/types";
import type { MediaPolicyName } from "./MigrationProfile";
import { ArticleContentPayloadSchema, type ArticleContentPayload } from "@/lib/publications/articleMvp";

const ARTICLE_SOURCE_RECORD_KEY_PATTERN = /^wordpress-db:post:(\d+)$/;

export function parseArticlePostIdFromSourceRecordKey(sourceRecordKey: string): number | null {
  const match = ARTICLE_SOURCE_RECORD_KEY_PATTERN.exec(sourceRecordKey.trim());
  return match ? Number(match[1]) : null;
}

export interface ArticleMediaReplayArgsGuardInput {
  entity: string;
  /** Count of `--source-record-key` occurrences in argv — not just whether one is present, so a mistaken second flag is caught rather than silently using the first. */
  sourceRecordKeyCount: number;
  mediaPolicyName: MediaPolicyName | undefined;
  /** The unrelated `--force-reprocess` flag (Place/Article UPDATE reprocessing) — must never be combined with this one. */
  forceReprocess: boolean;
  /** The unrelated, Event-only `--force-media-reprocess` flag — must never be combined with this one either; they are two different replay tools for two different entities. */
  forceMediaReprocess: boolean;
  /** Article has no natural media-owner field (`authorUserId` is nullable and frequently null — confirmed on the golden fixture), unlike Place/Event, so this replay requires an explicit operator-supplied owner rather than ever inventing or defaulting one. */
  mediaOwnerUserId: string | undefined;
}

export type ArticleMediaReplayGuardResult = { ok: true } | { ok: false; reason: string };

/** Pure, synchronous — no I/O, testable without a DB/SSH connection. */
export function validateArticleMediaReplayArgs(input: ArticleMediaReplayArgsGuardInput): ArticleMediaReplayGuardResult {
  if (input.entity !== "article") {
    return { ok: false, reason: "--force-article-media-replay requires --entity article." };
  }
  if (input.sourceRecordKeyCount !== 1) {
    return {
      ok: false,
      reason: `--force-article-media-replay requires exactly one --source-record-key (found ${input.sourceRecordKeyCount}).`,
    };
  }
  if (input.mediaPolicyName !== "FULL") {
    return { ok: false, reason: "--force-article-media-replay requires --media-policy FULL." };
  }
  if (input.forceReprocess) {
    return { ok: false, reason: "--force-article-media-replay cannot be combined with --force-reprocess." };
  }
  if (input.forceMediaReprocess) {
    return { ok: false, reason: "--force-article-media-replay cannot be combined with --force-media-reprocess (that flag is Event-only)." };
  }
  if (!input.mediaOwnerUserId?.trim()) {
    return { ok: false, reason: "--force-article-media-replay requires --media-owner-user-id <userId>." };
  }
  return { ok: true };
}

export interface ArticleMediaReplayLineageLike {
  sourceId: string;
  isActive: boolean;
  targetId: string | null;
  lastSourceHash: string | null;
}

export interface ArticleMediaReplayRuntimeGuardInput {
  bundle: WordPressArticleBundle | null;
  /** The active ARTICLE lineage row for this sourceRecordKey, or null if none/ambiguous — caller is expected to have already confirmed there is at most one (`isActive: true`) row, e.g. via `count()`. */
  lineage: ArticleMediaReplayLineageLike | null;
  /** Whether more than one active ARTICLE lineage row exists for this sourceRecordKey — always an unconditional refusal regardless of what `lineage` itself contains. */
  activeLineageCount: number;
  targetExists: boolean;
  /** Raw nullable Prisma `Article.contentJson` snapshot; strictly validated here rather than normalized through the application's fallback parser. */
  targetContentJson: unknown;
  /**
   * Review finding (PR #68, P1 #2): `--media-owner-user-id` was previously
   * only checked for being a non-empty string, never that it names a real
   * `User`. The real `MediaImporterLike` downloads and processes the file
   * and writes it to storage *before* `registerUploadedMedia()` is ever
   * called with `uploadedById` — so an invalid owner id would only be
   * discovered after those writes already happened, leaving orphaned
   * files behind on every retry. Caller is expected to have already
   * checked this with a read-only `prisma.user.findUnique()` lookup.
   */
  ownerUserExists: boolean;
}

export type ArticleMediaReplayRuntimeGuardResult =
  | { ok: true; freshHash: string; candidate: NormalizedArticleCandidate; targetContentJson: ArticleContentPayload }
  | { ok: false; reason: string };

/**
 * The hash-equality check is load-bearing: it is what makes this replay
 * provably media-only. If the live source has drifted at all since the
 * hash was last recorded, this refuses — a domain-content change must go
 * through a real, reviewed UPDATE, never through this path.
 */
export function validateArticleMediaReplayRuntime(input: ArticleMediaReplayRuntimeGuardInput): ArticleMediaReplayRuntimeGuardResult {
  if (!input.ownerUserExists) {
    return {
      ok: false,
      reason: "--media-owner-user-id does not match any existing User — refusing before any media download/storage write.",
    };
  }
  if (input.activeLineageCount !== 1) {
    return {
      ok: false,
      reason: `Expected exactly one active ARTICLE lineage row for this sourceRecordKey, found ${input.activeLineageCount}.`,
    };
  }
  if (!input.bundle) {
    return { ok: false, reason: "No live published WordPress article found for this sourceRecordKey." };
  }
  if (!input.lineage || !input.lineage.isActive) {
    return { ok: false, reason: "No active ARTICLE lineage found for this sourceRecordKey." };
  }
  if (!input.lineage.targetId || !input.targetExists) {
    return { ok: false, reason: "Target Article not found for this lineage." };
  }
  const targetContentResult = ArticleContentPayloadSchema.safeParse(input.targetContentJson);
  if (!targetContentResult.success) {
    return {
      ok: false,
      reason: "Target Article contentJson is null or does not match ArticleContentPayload schema — media replay refused.",
    };
  }
  const storedHash = input.lineage.lastSourceHash;
  if (!storedHash || !storedHash.startsWith(`${CANONICAL_SOURCE_HASH_VERSION}:`)) {
    return {
      ok: false,
      reason: `Stored lineage hash is not in canonical ${CANONICAL_SOURCE_HASH_VERSION} format.`,
    };
  }
  const freshHash = hashArticleBundle(input.bundle);
  if (freshHash !== storedHash) {
    return {
      ok: false,
      reason: "Freshly computed canonical hash does not match the stored lineage hash — domain source drift detected; refusing a media-only replay.",
    };
  }
  const normalized = normalizeArticle(input.bundle);
  const candidate = normalized.normalizedPayload as NormalizedArticleCandidate;
  const draft = buildArticleCreateDraft({ candidate, context: {} });
  if (!draft.ok) {
    return {
      ok: false,
      reason: `Source Article is not representable (${draft.reasons.map((reason) => reason.code).join(", ")}) — media replay refused.`,
    };
  }
  return { ok: true, freshHash, candidate, targetContentJson: targetContentResult.data };
}
