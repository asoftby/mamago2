/**
 * Fail-closed, atomic Article media replay: reconstructs `contentJson` with
 * real image blocks from the live WordPress source and links
 * `Article.coverImageId`, but only after every required guard passes —
 * never a partial update, never silently different behavior for a case
 * this module wasn't explicitly told is safe.
 *
 * Three read-only preflight layers run *before* any import or write, so a
 * `REFUSED` result here always has zero side effects:
 * 1. **Attachment allowlist** — every image found *inline* by the position-
 *    preserving content pipeline must have a `wp-image-<id>` attachment id
 *    that is in the caller-supplied `inlineAttachmentAllowlist`, and that
 *    allowlist must be fully accounted for (no extra, no missing) — an
 *    image without an id at all (not WordPress-class-tagged) is
 *    "ambiguous" and refuses the whole replay, never silently dropped or
 *    guessed at. `featuredAttachmentId` is deliberately validated and
 *    imported *separately* from this exact-match check (review finding,
 *    PR #68 P1 #1): a featured/cover image frequently never appears inline
 *    in `post_content` at all (confirmed on real source data — the golden
 *    fixture only passes the old, merged check by coincidence, because its
 *    cover happens to also be embedded inline), so requiring it to be a
 *    member of the inline set would wrongly refuse an entire, very common
 *    class of otherwise-valid Articles.
 * 2. **Content divergence** — the non-image block projection reconstructed
 *    from the live source must exactly match the Article's *current*
 *    stored `contentJson` (image blocks filtered out of both sides before
 *    comparing, so this is equally strict on a first run and on an
 *    idempotent re-run after a prior successful replay) — any mismatch
 *    means the text content diverged from what this replay is allowed to
 *    touch, most likely a manual edit, and refuses before any import.
 * 3. **Existing-media provenance** (`checkAttachmentLineageStates()`) — a
 *    whole-replay read-only check that classifies every requested attachment
 *    before import. Any dangling active lineage fails the entire replay;
 *    usable lineage states also power the already-fully-synced NOOP check.
 *
 * Only once all three pass does this import (dedup-or-reuse per unique
 * attachment id — a duplicate reference in the content is a single import
 * shared by every occurrence, never a second `MediaAsset`) and then apply
 * `Article.contentJson`/`coverImageId` in one Prisma transaction, with a
 * concurrency guard that re-proves the target hasn't changed since
 * preflight (mirrors `strictEventMediaReplay.ts`'s
 * `TargetChangedDuringReplayError` pattern). No other `Article` column is
 * ever part of the update.
 *
 * That same transaction also calls `syncArticleContentMediaUsages()` right
 * after the CAS succeeds, so every inline/gallery `MediaAsset` this replay
 * just wrote into `contentJson` gets a matching `MediaUsage` row atomically
 * with it — `hasPublishedPublicLinkage()` (the public media-file gate)
 * already trusts `MediaUsage` for `ARTICLE`, it just never had rows to
 * find here before. A `MediaUsage` write failure rolls back the `Article`
 * update in the same transaction; a CAS failure never reaches the usage
 * sync at all.
 */
import type { Prisma, PrismaClient } from "@prisma/client";
import type { ArticleBlockMvp, ArticleContentPayload } from "@/lib/publications/articleMvp";
import { serializeArticleContent } from "@/lib/publications/articleMvp";
import {
  normalizeMigrationContent,
  normalizedContentToArticleContentJson,
  normalizedContentToArticleContentJsonWithMedia,
} from "../content";
import type { NormalizedContentBlock } from "../content";
import type {
  ArticleAttachmentImportOutcome,
  ExistingAttachmentLineageState,
  ResolveAndImportArticleAttachmentsInput,
} from "../commit/article/ArticleMediaReplaySyncer";
import { syncArticleContentMediaUsages } from "@/server/services/media/media-usage.service";

export interface StrictArticleMediaImporter {
  checkAttachmentLineageStates(input: {
    ids: readonly number[];
    sourceId: string;
  }): Promise<Map<number, ExistingAttachmentLineageState>>;
  resolveAndImportAttachments(input: ResolveAndImportArticleAttachmentsInput): Promise<Map<number, ArticleAttachmentImportOutcome>>;
}

/**
 * The narrow slice of Prisma needed for the final atomic apply —
 * shape-compatible with both a real `PrismaClient` and its `$transaction`
 * callback argument. `mediaUsage` is required here (not optional) so that
 * every real caller is forced to wire the same transaction into
 * `syncArticleContentMediaUsages()` below — a `contentJson` write without a
 * matching `MediaUsage` sync in the same transaction is exactly the bug
 * this module closes.
 */
export interface StrictArticleMediaReplayTxClient {
  article: Pick<PrismaClient["article"], "updateMany">;
  mediaUsage: Pick<PrismaClient["mediaUsage"], "deleteMany" | "createMany">;
}

export interface StrictArticleMediaReplayPrismaClient extends StrictArticleMediaReplayTxClient {
  $transaction<T>(fn: (tx: StrictArticleMediaReplayTxClient) => Promise<T>): Promise<T>;
}

/** Caller-supplied snapshot of the target's *current* state, taken immediately before calling this function. */
export interface StrictArticleMediaReplayCurrentState {
  contentJson: ArticleContentPayload;
  coverImageId: string | null;
}

export interface RunStrictArticleMediaReplayInput {
  articleId: string;
  sourceId: string;
  sourceHash: string;
  /** Raw WordPress `post_content` HTML — `NormalizedArticleCandidate.content`. */
  rawContent: string;
  featuredAttachmentId: number | null;
  /**
   * Exact, caller-supplied set of *inline* attachment ids this replay is
   * allowed to touch — see module doc comment, guard 1. Deliberately
   * excludes `featuredAttachmentId`, which is validated/imported on its
   * own and is not required to also appear inline.
   */
  inlineAttachmentAllowlist: readonly number[];
  ownerUserId: string;
  current: StrictArticleMediaReplayCurrentState;
  mediaImporter: StrictArticleMediaImporter;
  prisma: StrictArticleMediaReplayPrismaClient;
}

export interface AttachmentFailure {
  attachmentId: number;
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

export type StrictArticleMediaReplayResult =
  | {
      status: "APPLIED";
      coverMediaId: string | null;
      imageBlockCount: number;
      reusedAttachmentIds: readonly number[];
      importedAttachmentIds: readonly number[];
    }
  | { status: "NOOP_ALREADY_SYNCED"; coverMediaId: string | null; imageBlockCount: number }
  | { status: "REFUSED"; code: string; message: string; details?: Record<string, unknown> }
  | { status: "FAILED"; code: string; message: string; failures: readonly AttachmentFailure[] };

function isOk(outcome: ArticleAttachmentImportOutcome): outcome is Extract<ArticleAttachmentImportOutcome, { ok: true }> {
  return outcome.ok;
}

function uniqueInOrder(ids: readonly number[]): number[] {
  return ids.filter((id, index, all) => all.indexOf(id) === index);
}

function setsEqual(a: ReadonlySet<number>, b: ReadonlySet<number>): boolean {
  return a.size === b.size && [...a].every((id) => b.has(id));
}

/**
 * Order-insensitive-key deep equality that also treats an `undefined`-
 * valued key as absent, matching `JSON.stringify`/Postgres JSONB semantics
 * exactly: a freshly-built-in-memory block (e.g. `{alt: undefined,
 * caption: undefined}` from an object literal that always sets every
 * field) must compare equal to the same block after a real round trip
 * through `serializeArticleContent()` (`JSON.parse(JSON.stringify(...))`,
 * which drops those keys entirely) and back out of Postgres — otherwise
 * every idempotent re-run would see a false divergence between its own
 * fresh reconstruction and what's actually stored. Key *order* itself is
 * also ignored, since Postgres JSONB round-tripping doesn't preserve
 * original insertion order either.
 */
function deepEqualIgnoreKeyOrder(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== typeof b || a === null || b === null) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((value, index) => deepEqualIgnoreKeyOrder(value, b[index]));
  }
  if (typeof a === "object" && typeof b === "object") {
    const recordA = a as Record<string, unknown>;
    const recordB = b as Record<string, unknown>;
    const keysA = Object.keys(recordA).filter((key) => recordA[key] !== undefined).sort();
    const keysB = Object.keys(recordB).filter((key) => recordB[key] !== undefined).sort();
    if (keysA.length !== keysB.length || keysA.some((key, index) => key !== keysB[index])) return false;
    return keysA.every((key) => deepEqualIgnoreKeyOrder(recordA[key], recordB[key]));
  }
  return false;
}

/**
 * `id` (`normalized-content-block-<n>`) is a positional artifact of
 * *which* downconverter produced a given block sequence, not semantic
 * content: the default downconverter never lets an image consume an id
 * slot, while the media-aware one does — so after a real replay has run
 * once, the surviving text blocks' ids differ from what a fresh
 * image-stripped reconstruction would assign them, even though nothing
 * about the text itself changed. Every content comparison in this module
 * must ignore `id` for exactly this reason.
 */
function omitId(block: ArticleBlockMvp): Omit<ArticleBlockMvp, "id"> {
  const rest: Partial<ArticleBlockMvp> = { ...block };
  delete rest.id;
  return rest as Omit<ArticleBlockMvp, "id">;
}

function nonImageBlocks(blocks: readonly ArticleBlockMvp[]): Omit<ArticleBlockMvp, "id">[] {
  return blocks.filter((block) => block.type !== "image" && block.type !== "gallery").map(omitId);
}

class TargetChangedDuringReplayError extends Error {}

export async function runStrictArticleMediaReplay(
  input: RunStrictArticleMediaReplayInput,
): Promise<StrictArticleMediaReplayResult> {
  const inlineAllowlist = uniqueInOrder(input.inlineAttachmentAllowlist);
  const importAttachmentIds = uniqueInOrder(
    input.featuredAttachmentId !== null ? [input.featuredAttachmentId, ...inlineAllowlist] : inlineAllowlist,
  );
  if (importAttachmentIds.length === 0) {
    return {
      status: "REFUSED",
      code: "ARTICLE_MEDIA_REPLAY_ALLOWLIST_EMPTY",
      message: "Neither featuredAttachmentId nor inlineAttachmentAllowlist name any attachment — there is no media this replay is allowed to touch.",
    };
  }

  // --- Guard 1: reconstruct with image positions, check every found image
  // is on the allowlist and the allowlist is fully accounted for. ---
  const reconstructed = normalizeMigrationContent({
    sourceKind: "wordpress",
    raw: input.rawContent,
    preserveImagePositions: true,
  });
  const imageBlocks = reconstructed.blocks.filter(
    (block): block is Extract<NormalizedContentBlock, { type: "image" }> => block.type === "image",
  );

  const ambiguous = imageBlocks.filter((block) => block.attachmentId === undefined);
  if (ambiguous.length > 0) {
    return {
      status: "REFUSED",
      code: "ARTICLE_MEDIA_REPLAY_AMBIGUOUS_IMAGE",
      message: "One or more images in the source content have no resolvable wp-image-<id> attachment id — refusing before any import.",
      details: { srcs: ambiguous.map((block) => block.src) },
    };
  }

  const foundInlineIds = new Set(imageBlocks.map((block) => block.attachmentId as number));
  const inlineAllowlistSet = new Set(inlineAllowlist);
  if (!setsEqual(foundInlineIds, inlineAllowlistSet)) {
    return {
      status: "REFUSED",
      code: "ARTICLE_MEDIA_REPLAY_ALLOWLIST_MISMATCH",
      message: "The inline attachment ids found in the live source do not exactly match inlineAttachmentAllowlist — refusing before any import.",
      details: {
        foundNotAllowed: [...foundInlineIds].filter((id) => !inlineAllowlistSet.has(id)),
        allowedNotFound: [...inlineAllowlistSet].filter((id) => !foundInlineIds.has(id)),
      },
    };
  }

  // --- Guard 2: content divergence — non-image projection of the live
  // source must exactly match the Article's current stored contentJson,
  // image blocks stripped from both sides (so this is equally strict on a
  // first run and on an idempotent re-run after a prior success). ---
  const reconstructedProjection = nonImageBlocks(normalizedContentToArticleContentJson(reconstructed).contentJson.blocks);
  const currentNonImage = nonImageBlocks(input.current.contentJson.blocks);
  if (!deepEqualIgnoreKeyOrder(reconstructedProjection, currentNonImage)) {
    return {
      status: "REFUSED",
      code: "ARTICLE_MEDIA_REPLAY_CONTENT_DIVERGENCE",
      message: "The live source's non-image content no longer matches the Article's current contentJson — refusing to overwrite a possible manual edit.",
    };
  }

  // --- Guard 3: whole-replay read-only lineage preflight. Every requested
  // attachment is classified before resolve/import can create an importer
  // or cause any download/write. ---
  const lineageStates = await input.mediaImporter.checkAttachmentLineageStates({ ids: importAttachmentIds, sourceId: input.sourceId });
  const lineageFailures: AttachmentFailure[] = [];
  for (const attachmentId of importAttachmentIds) {
    const lineageState = lineageStates.get(attachmentId);
    if (!lineageState) {
      lineageFailures.push({
        attachmentId,
        code: "ARTICLE_MEDIA_LINEAGE_STATE_MISSING",
        message: "No lineage preflight state was returned for this attachment id.",
      });
    } else if (lineageState.state === "DANGLING_ACTIVE_LINEAGE") {
      lineageFailures.push({
        attachmentId,
        code: "ARTICLE_MEDIA_DANGLING_LINEAGE",
        message: "An active MEDIA_ASSET lineage row exists for this attachment but its target is missing/deleted.",
        details: { attachmentId, lineageTargetId: lineageState.lineageTargetId },
      });
    }
  }
  if (lineageFailures.length > 0) {
    const hasDanglingLineage = lineageFailures.some((failure) => failure.code === "ARTICLE_MEDIA_DANGLING_LINEAGE");
    return {
      status: "FAILED",
      code: hasDanglingLineage ? "ARTICLE_MEDIA_DANGLING_LINEAGE" : "ARTICLE_MEDIA_REPLAY_LINEAGE_PREFLIGHT_INCOMPLETE",
      message: "Article media lineage preflight failed — the entire replay was stopped before import and Article was left untouched.",
      failures: lineageFailures,
    };
  }

  // --- NOOP short-circuit from the same preflight result. ---
  const provenMap = new Map<number, { mediaId: string; publicUrl: string }>();
  for (const [attachmentId, lineageState] of lineageStates) {
    if (lineageState.state === "USABLE_LINEAGE") {
      provenMap.set(attachmentId, { mediaId: lineageState.mediaId, publicUrl: lineageState.publicUrl });
    }
  }
  const fullyProven = importAttachmentIds.every((id) => provenMap.has(id));
  if (fullyProven) {
    const provenCoverMediaId = input.featuredAttachmentId !== null ? provenMap.get(input.featuredAttachmentId)!.mediaId : null;
    const prospective = normalizedContentToArticleContentJsonWithMedia(reconstructed, (block) => {
      const proven = block.attachmentId !== undefined ? provenMap.get(block.attachmentId) : undefined;
      return proven ? { mediaId: proven.mediaId, alt: block.alt } : null;
    }).contentJson.blocks.map(omitId);

    if (
      input.current.coverImageId === provenCoverMediaId &&
      deepEqualIgnoreKeyOrder(prospective, input.current.contentJson.blocks.map(omitId))
    ) {
      return {
        status: "NOOP_ALREADY_SYNCED",
        coverMediaId: provenCoverMediaId,
        imageBlockCount: imageBlocks.length,
      };
    }
  }

  // --- Import phase: only reached once every read-only guard has passed. ---
  const outcomes = await input.mediaImporter.resolveAndImportAttachments({
    ids: importAttachmentIds,
    ownerUserId: input.ownerUserId,
    sourceId: input.sourceId,
    sourceHash: input.sourceHash,
    runId: null,
    recordId: null,
  });

  const failures: AttachmentFailure[] = [];
  for (const attachmentId of importAttachmentIds) {
    const outcome = outcomes.get(attachmentId);
    if (!outcome) {
      failures.push({
        attachmentId,
        code: "ARTICLE_MEDIA_REPLAY_OUTCOME_MISSING",
        message: "No import outcome was returned for this attachment id.",
      });
    } else if (!outcome.ok) {
      failures.push({ attachmentId, code: outcome.code, message: outcome.message, details: outcome.details });
    }
  }
  if (failures.length > 0) {
    return {
      status: "FAILED",
      code: "ARTICLE_MEDIA_REPLAY_IMPORT_INCOMPLETE",
      message:
        "One or more required attachments could not be resolved or imported — Article was left untouched. Already-created MediaAsset/MEDIA_ASSET lineage rows (if any) are safe to leave in place for an idempotent retry.",
      failures,
    };
  }

  function requireResolvedMediaId(attachmentId: number): { mediaId: string; publicUrl: string } {
    const outcome = outcomes.get(attachmentId);
    if (!outcome || !isOk(outcome)) {
      throw new Error(`Unreachable: no successful outcome for attachment ${attachmentId} after the failures check passed.`);
    }
    return outcome;
  }

  const resolvedCoverMediaId = input.featuredAttachmentId !== null ? requireResolvedMediaId(input.featuredAttachmentId).mediaId : null;
  const finalContentJson = normalizedContentToArticleContentJsonWithMedia(reconstructed, (block) => {
    if (block.attachmentId === undefined) return null;
    const resolved = requireResolvedMediaId(block.attachmentId);
    return { mediaId: resolved.mediaId, alt: block.alt };
  }).contentJson;

  // --- Atomic compare-and-swap apply. The expected snapshot is part of the
  // update predicate itself, so an edit committed at any point after
  // preflight cannot be overwritten by a later unconditional write. File
  // downloads already happened above, outside this transaction. ---
  try {
    await input.prisma.$transaction(async (tx) => {
      const expectedContentJson = serializeArticleContent(input.current.contentJson) as Prisma.InputJsonValue;
      const nextContentJson = serializeArticleContent(finalContentJson) as Prisma.InputJsonValue;
      const applyResult = await tx.article.updateMany({
        where: {
          id: input.articleId,
          coverImageId: input.current.coverImageId,
          contentJson: { equals: expectedContentJson },
        },
        data: {
          contentJson: nextContentJson,
          coverImageId: resolvedCoverMediaId,
        },
      });
      if (applyResult.count !== 1) {
        throw new TargetChangedDuringReplayError();
      }
      // Same transaction as the CAS above: a failure here rolls back the
      // Article update too (see this module's doc comment), and the CAS
      // having already thrown above means this line is only ever reached
      // once the new contentJson is the one actually being committed.
      await syncArticleContentMediaUsages({ tx, articleId: input.articleId, contentJson: finalContentJson });
    });
  } catch (error) {
    if (error instanceof TargetChangedDuringReplayError) {
      return {
        status: "REFUSED",
        code: "ARTICLE_MEDIA_REPLAY_TARGET_CHANGED_DURING_REPLAY",
        message: "Article contentJson/coverImageId changed between preflight and apply — refusing to overwrite a concurrent edit. The transaction was rolled back.",
      };
    }
    throw error;
  }

  const reusedAttachmentIds = importAttachmentIds.filter((id) => {
    const outcome = outcomes.get(id);
    return outcome && isOk(outcome) && outcome.reused;
  });
  const importedAttachmentIds = importAttachmentIds.filter((id) => {
    const outcome = outcomes.get(id);
    return outcome && isOk(outcome) && !outcome.reused;
  });

  return {
    status: "APPLIED",
    coverMediaId: resolvedCoverMediaId,
    imageBlockCount: finalContentJson.blocks.filter((block) => block.type === "image").length,
    reusedAttachmentIds,
    importedAttachmentIds,
  };
}
