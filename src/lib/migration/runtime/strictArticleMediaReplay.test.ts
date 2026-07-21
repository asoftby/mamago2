/**
 * Run: tsx src/lib/migration/runtime/strictArticleMediaReplay.test.ts (assert-based, project convention).
 *
 * Uses the real `ArticleMediaReplaySyncer` (not a fake) as the
 * `mediaImporter`, so the resolve/import/reuse path exercised here is
 * exactly the one production code runs — only `runStrictArticleMediaReplay`'s
 * own preflight/divergence/atomic-apply logic is under test. The fake
 * `$transaction` genuinely stages writes and only commits them if the
 * callback resolves without throwing.
 */
import assert from "node:assert/strict";

import { ArticleMediaReplaySyncer, type ArticleMediaReplaySyncerPrismaClient } from "../commit/article/ArticleMediaReplaySyncer";
import type { WordPressAttachmentRow } from "../adapters/wordpress-db/types";
import type { MediaImporterLike, MediaLineageWriterLike } from "../media/types";
import {
  runStrictArticleMediaReplay,
  type RunStrictArticleMediaReplayInput,
  type StrictArticleMediaReplayPrismaClient,
  type StrictArticleMediaReplayTxClient,
} from "./strictArticleMediaReplay";
import type { ArticleBlockMvp, ArticleContentPayload } from "@/lib/publications/articleMvp";

const OWNER_USER_ID = "user-1";
const SOURCE_ID = "source-1";
const SOURCE_HASH = "wordpress-db-domain-v2:abc123";
const ARTICLE_ID = "article-1";

/** Gallery-of-two-images sample, matching the golden fixture's real markup shape (one anchor-wrapped, one direct). */
const RAW_HTML = [
  "<p>Intro paragraph.</p>",
  '<figure class="wp-block-image"><img src="https://wp.example.com/a-576x1024.jpg" alt="" class="wp-image-111"/></figure>',
  '<figure class="wp-block-image"><a href="https://wp.example.com/a.jpg"><img src="https://wp.example.com/b-576x1024.jpg" alt="" class="wp-image-222"/></a></figure>',
  "<p>Final paragraph.</p>",
].join("\n");
const ALLOWLIST = [111, 222];
const FEATURED_ID = 111;

/** The non-image projection `RAW_HTML` produces — this is what `Article.contentJson` must already equal for the divergence guard to pass. */
const CURRENT_TEXT_ONLY_CONTENT: ArticleContentPayload = {
  version: 1,
  blocks: [
    { id: "normalized-content-block-1", type: "intro", text: "Intro paragraph." },
    { id: "normalized-content-block-2", type: "text", text: "Final paragraph." },
  ],
};

function attachment(id: number, overrides: Partial<WordPressAttachmentRow> = {}): WordPressAttachmentRow {
  return {
    ID: id,
    post_title: `Attachment ${id}`,
    post_name: `attachment-${id}`,
    post_mime_type: "image/jpeg",
    guid: `https://wp.example.com/${id}.jpg`,
    post_parent: 9704,
    attached_file: null,
    ...overrides,
  };
}

interface HarnessOptions {
  missingAttachmentIds?: readonly number[];
  failImportIds?: readonly number[];
  existingMediaIds?: readonly number[];
  initialCoverImageId?: string | null;
  initialContentJson?: ArticleContentPayload;
  /** Attachment ids beyond ALLOWLIST the harness's WordPress attachment resolver should also know about — e.g. a featured/cover image that never appears inline in the content. */
  extraAttachmentIds?: readonly number[];
}

function createHarness(options: HarnessOptions = {}) {
  const attachments = new Map<number, WordPressAttachmentRow>();
  for (const id of [...ALLOWLIST, ...(options.extraAttachmentIds ?? [])]) {
    if (!options.missingAttachmentIds?.includes(id)) attachments.set(id, attachment(id));
  }

  const mediaAssets = new Map<string, { id: string; publicUrl: string; deletedAt: null }>();
  const lineages = new Map<string, string>(); // sourceRecordKey -> mediaAssetId
  const importCalls: string[] = [];
  let nextMediaId = 1;

  for (const id of options.existingMediaIds ?? []) {
    const mediaId = `existing-media-${id}`;
    mediaAssets.set(mediaId, { id: mediaId, publicUrl: `https://cdn.example.com/existing-${id}.jpg`, deletedAt: null });
    lineages.set(`wordpress-db:attachment:${id}`, mediaId);
  }

  const prisma: ArticleMediaReplaySyncerPrismaClient = {
    migrationLineage: {
      findFirst: (async (args: { where: { sourceRecordKey: string } }) => {
        const mediaId = lineages.get(args.where.sourceRecordKey);
        return mediaId ? { targetId: mediaId } : null;
      }) as unknown as ArticleMediaReplaySyncerPrismaClient["migrationLineage"]["findFirst"],
    },
    mediaAsset: {
      findFirst: (async (args: { where: { id: string } }) => mediaAssets.get(args.where.id) ?? null) as unknown as ArticleMediaReplaySyncerPrismaClient["mediaAsset"]["findFirst"],
    },
  };

  const mediaImporterFactory = (): MediaImporterLike => ({
    importFromUrl: async (input) => {
      importCalls.push(input.sourceRecordKey);
      const idMatch = /attachment:(\d+)$/.exec(input.sourceRecordKey);
      const attachmentId = idMatch ? Number(idMatch[1]) : -1;
      if (options.failImportIds?.includes(attachmentId)) {
        throw new Error(`Simulated download failure for attachment ${attachmentId}`);
      }
      const mediaId = `media-${nextMediaId++}`;
      const publicUrl = `https://cdn.example.com/${mediaId}.jpg`;
      mediaAssets.set(mediaId, { id: mediaId, publicUrl, deletedAt: null });
      return { mediaId, storageKey: `${mediaId}/file.jpg`, publicUrl };
    },
  });

  const lineageWriter: MediaLineageWriterLike = {
    createLineage: async (input) => {
      lineages.set(input.sourceRecordKey, input.targetId);
      return { lineageId: `lineage-${input.sourceRecordKey}`, sourceRecordKey: input.sourceRecordKey, targetType: input.targetType, targetId: input.targetId };
    },
  };

  const syncer = new ArticleMediaReplaySyncer({
    prisma,
    attachmentResolver: { getAttachmentsByIds: async (ids) => new Map(ids.filter((id) => attachments.has(id)).map((id) => [id, attachments.get(id)!])) },
    mediaImporterFactory,
    lineageWriter,
  });

  let articleState = {
    contentJson: options.initialContentJson ?? CURRENT_TEXT_ONLY_CONTENT,
    coverImageId: options.initialCoverImageId ?? null,
  };
  const updateCalls: { data: Record<string, unknown> }[] = [];

  const txClient: StrictArticleMediaReplayTxClient = {
    article: {
      findUnique: (async () =>
        ({ contentJson: articleState.contentJson, coverImageId: articleState.coverImageId })) as unknown as StrictArticleMediaReplayTxClient["article"]["findUnique"],
      update: (async (args: { data: { contentJson: ArticleContentPayload; coverImageId: string | null } }) => {
        updateCalls.push({ data: args.data });
        articleState = {
          contentJson: args.data.contentJson,
          coverImageId: args.data.coverImageId,
        };
        return { id: ARTICLE_ID };
      }) as unknown as StrictArticleMediaReplayTxClient["article"]["update"],
    },
  };

  const prismaWithTx: StrictArticleMediaReplayPrismaClient = {
    ...txClient,
    $transaction: async <T>(fn: (tx: StrictArticleMediaReplayTxClient) => Promise<T>): Promise<T> => {
      // Real staged-commit semantics: run against the same mutable txClient;
      // if fn throws, articleState was never mutated (update() is the only
      // mutator and it's only called from inside fn).
      return fn(txClient);
    },
  };

  return { syncer, prismaWithTx, importCalls, getArticleState: () => articleState, updateCalls };
}

function baseInput(
  harness: ReturnType<typeof createHarness>,
  overrides: Partial<RunStrictArticleMediaReplayInput> = {},
): RunStrictArticleMediaReplayInput {
  return {
    articleId: ARTICLE_ID,
    sourceId: SOURCE_ID,
    sourceHash: SOURCE_HASH,
    rawContent: RAW_HTML,
    featuredAttachmentId: FEATURED_ID,
    inlineAttachmentAllowlist: ALLOWLIST,
    ownerUserId: OWNER_USER_ID,
    current: { contentJson: harness.getArticleState().contentJson, coverImageId: harness.getArticleState().coverImageId },
    mediaImporter: harness.syncer,
    prisma: harness.prismaWithTx,
    ...overrides,
  };
}

async function testFeaturedCoverAbsentFromContentStillSucceeds() {
  // PR #68 review, P1 #1: a featured/cover image (999) that never appears
  // inline in post_content at all — a very common real-world case (the old,
  // merged allowlist would have wrongly refused this as `allowedNotFound`;
  // the golden fixture only avoided that by coincidence).
  const rawContentWithoutFeaturedInline = [
    "<p>Intro paragraph.</p>",
    '<img src="https://wp.example.com/a-576x1024.jpg" alt="" class="wp-image-111"/>',
    "<p>Final paragraph.</p>",
  ].join("\n");
  const currentForThisContent: ArticleContentPayload = {
    version: 1,
    blocks: [
      { id: "a", type: "intro", text: "Intro paragraph." },
      { id: "b", type: "text", text: "Final paragraph." },
    ],
  };
  const harness = createHarness({ extraAttachmentIds: [999], initialContentJson: currentForThisContent });
  const result = await runStrictArticleMediaReplay(
    baseInput(harness, {
      rawContent: rawContentWithoutFeaturedInline,
      featuredAttachmentId: 999,
      inlineAttachmentAllowlist: [111],
      current: { contentJson: currentForThisContent, coverImageId: null },
    }),
  );

  assert.equal(result.status, "APPLIED");
  if (result.status !== "APPLIED") return;
  assert.ok(result.coverMediaId, "the featured attachment was still resolved and imported, despite never appearing inline");
  assert.deepEqual([...result.importedAttachmentIds].sort(), [111, 999]);
  assert.equal(result.imageBlockCount, 1, "only the one genuinely inline image becomes a contentJson image block");
}

async function testSuccessfulReplayAppliesOnlyContentJsonAndCover() {
  const harness = createHarness();
  const result = await runStrictArticleMediaReplay(baseInput(harness));

  assert.equal(result.status, "APPLIED");
  if (result.status !== "APPLIED") return;
  assert.equal(result.imageBlockCount, 2);
  assert.deepEqual([...result.importedAttachmentIds].sort(), [111, 222]);
  assert.deepEqual(result.reusedAttachmentIds, []);

  assert.equal(harness.updateCalls.length, 1, "exactly one Article update");
  const { data } = harness.updateCalls[0];
  assert.deepEqual(Object.keys(data).sort(), ["contentJson", "coverImageId"], "only contentJson/coverImageId are ever part of the update");

  const finalState = harness.getArticleState();
  const types = (finalState.contentJson as ArticleContentPayload).blocks.map((b) => b.type);
  assert.deepEqual(types, ["intro", "image", "image", "text"], "images land at their interleaved position");
  assert.equal(finalState.coverImageId, result.coverMediaId);
}

async function testIdempotentReplayIsNoop() {
  const harness = createHarness();
  const first = await runStrictArticleMediaReplay(baseInput(harness));
  assert.equal(first.status, "APPLIED");

  const importCallsAfterFirst = harness.importCalls.length;
  const second = await runStrictArticleMediaReplay(
    baseInput(harness, { current: { contentJson: harness.getArticleState().contentJson, coverImageId: harness.getArticleState().coverImageId } }),
  );

  assert.equal(second.status, "NOOP_ALREADY_SYNCED");
  assert.equal(harness.importCalls.length, importCallsAfterFirst, "zero new downloads on repeat replay");
  assert.equal(harness.updateCalls.length, 1, "no second Article update — still just the one from the first run");
}

async function testUnexpectedAttachmentOutsideAllowlistRefuses() {
  // RAW_HTML_EXTRA has a third image (id 333) not in ALLOWLIST.
  const rawHtmlExtra = RAW_HTML.replace(
    "<p>Final paragraph.</p>",
    '<figure class="wp-block-image"><img src="https://wp.example.com/c.jpg" alt="" class="wp-image-333"/></figure>\n<p>Final paragraph.</p>',
  );
  const harness = createHarness();
  const result = await runStrictArticleMediaReplay(baseInput(harness, { rawContent: rawHtmlExtra }));

  assert.equal(result.status, "REFUSED");
  if (result.status !== "REFUSED") return;
  assert.equal(result.code, "ARTICLE_MEDIA_REPLAY_ALLOWLIST_MISMATCH");
  assert.equal(harness.importCalls.length, 0, "no import attempted before the allowlist guard");
  assert.equal(harness.updateCalls.length, 0);
}

async function testContentDivergenceRefusesBeforeImport() {
  const divergedContent: ArticleContentPayload = {
    version: 1,
    blocks: [{ id: "x", type: "intro", text: "This text was manually edited after golden CREATE." }],
  };
  const harness = createHarness({ initialContentJson: divergedContent });
  const result = await runStrictArticleMediaReplay(baseInput(harness, { current: { contentJson: divergedContent, coverImageId: null } }));

  assert.equal(result.status, "REFUSED");
  if (result.status !== "REFUSED") return;
  assert.equal(result.code, "ARTICLE_MEDIA_REPLAY_CONTENT_DIVERGENCE");
  assert.equal(harness.importCalls.length, 0, "no import attempted before the divergence guard");
  assert.equal(harness.updateCalls.length, 0);
}

async function testMissingAttachmentFailsBeforeArticleUpdate() {
  const harness = createHarness({ missingAttachmentIds: [222] });
  const result = await runStrictArticleMediaReplay(baseInput(harness));

  assert.equal(result.status, "FAILED");
  if (result.status !== "FAILED") return;
  assert.equal(result.failures.length, 1);
  assert.equal(result.failures[0].attachmentId, 222);
  assert.equal(result.failures[0].code, "ARTICLE_MEDIA_ATTACHMENT_MISSING");
  assert.equal(harness.updateCalls.length, 0, "Article is never touched when any required attachment fails to resolve");
}

async function testDownloadFailureLeavesArticleUntouched() {
  const harness = createHarness({ failImportIds: [222] });
  const result = await runStrictArticleMediaReplay(baseInput(harness));

  assert.equal(result.status, "FAILED");
  if (result.status !== "FAILED") return;
  assert.equal(result.failures[0].code, "ARTICLE_MEDIA_DOWNLOAD_FAILED");
  assert.equal(harness.updateCalls.length, 0);
  assert.deepEqual(harness.getArticleState().contentJson, CURRENT_TEXT_ONLY_CONTENT, "Article contentJson unchanged after a failed replay");
}

async function testExistingLineageIsReusedWithoutNewDownload() {
  const harness = createHarness({ existingMediaIds: [111, 222] });
  const result = await runStrictArticleMediaReplay(baseInput(harness));

  // Both already proven from lineage alone -> NOOP path is only taken if
  // current state also already matches; here current has no images yet, so
  // this exercises the "proven but not yet applied" reuse path instead.
  assert.equal(result.status, "APPLIED");
  if (result.status !== "APPLIED") return;
  assert.deepEqual([...result.reusedAttachmentIds].sort(), [111, 222]);
  assert.deepEqual(result.importedAttachmentIds, []);
  assert.equal(harness.importCalls.length, 0, "zero downloads — both attachments were already backed by MigrationLineage");
}

// ---------------------------------------------------------------------------
// Self-review: B. Divergence comparator
// ---------------------------------------------------------------------------

async function testDivergenceDetectsReorderedBlocks() {
  // Same two text blocks as CURRENT_TEXT_ONLY_CONTENT, but swapped order —
  // must NOT be treated as equal to the reconstructed (intro, text) order.
  const reordered: ArticleContentPayload = {
    version: 1,
    blocks: [
      { id: "normalized-content-block-1", type: "text", text: "Final paragraph." },
      { id: "normalized-content-block-2", type: "intro", text: "Intro paragraph." },
    ],
  };
  const harness = createHarness({ initialContentJson: reordered });
  const result = await runStrictArticleMediaReplay(baseInput(harness, { current: { contentJson: reordered, coverImageId: null } }));
  assert.equal(result.status, "REFUSED");
  if (result.status !== "REFUSED") return;
  assert.equal(result.code, "ARTICLE_MEDIA_REPLAY_CONTENT_DIVERGENCE");
}

async function testDivergenceDetectsChangedSemanticField() {
  // Changing a heading's level (a real semantic field, not id/undefined)
  // must still be caught — only `id` and JSON-undefined keys are ignored.
  const htmlWithHeading = `${RAW_HTML}\n<h2>A heading</h2>`;
  const currentWithWrongLevel: ArticleContentPayload = {
    version: 1,
    blocks: [
      { id: "a", type: "intro", text: "Intro paragraph." },
      { id: "b", type: "text", text: "Final paragraph." },
      { id: "c", type: "heading", level: 3, text: "A heading" }, // reconstruction will produce level 2
    ],
  };
  const harness = createHarness({ initialContentJson: currentWithWrongLevel });
  const result = await runStrictArticleMediaReplay(
    baseInput(harness, { rawContent: htmlWithHeading, current: { contentJson: currentWithWrongLevel, coverImageId: null } }),
  );
  assert.equal(result.status, "REFUSED");
  if (result.status !== "REFUSED") return;
  assert.equal(result.code, "ARTICLE_MEDIA_REPLAY_CONTENT_DIVERGENCE");
}

async function testDivergenceIgnoresOnlyIdAndUndefinedKeys() {
  // Different `id` strings and an explicit `alt: undefined` key (vs. the
  // key being absent) must NOT cause a false-positive divergence — only
  // `id` and JSON-undefined-equivalent differences are ignored.
  const currentWithDifferentIdsAndExplicitUndefined = {
    version: 1,
    blocks: [
      { id: "totally-different-id-1", type: "intro", text: "Intro paragraph.", subtitle: undefined },
      { id: "totally-different-id-2", type: "text", text: "Final paragraph." },
    ],
  } as unknown as ArticleContentPayload;
  const harness = createHarness({ initialContentJson: currentWithDifferentIdsAndExplicitUndefined });
  const result = await runStrictArticleMediaReplay(
    baseInput(harness, { current: { contentJson: currentWithDifferentIdsAndExplicitUndefined, coverImageId: null } }),
  );
  assert.notEqual(result.status, "REFUSED", `expected no false-positive divergence, got: ${JSON.stringify(result)}`);
}

// ---------------------------------------------------------------------------
// Self-review: C. Attachment correlation (remaining, at the full-replay level)
// ---------------------------------------------------------------------------

async function testAmbiguousImageWithoutAttachmentIdRefusesBeforeImport() {
  const htmlWithAmbiguousImage = RAW_HTML.replace(
    "<p>Final paragraph.</p>",
    '<img src="https://example.com/external-no-wp-class.jpg" alt=""/>\n<p>Final paragraph.</p>',
  );
  const harness = createHarness();
  const result = await runStrictArticleMediaReplay(baseInput(harness, { rawContent: htmlWithAmbiguousImage }));
  assert.equal(result.status, "REFUSED");
  if (result.status !== "REFUSED") return;
  assert.equal(result.code, "ARTICLE_MEDIA_REPLAY_AMBIGUOUS_IMAGE");
  assert.equal(harness.importCalls.length, 0, "no import attempted before the ambiguous-image guard");
}

async function testDuplicateAttachmentOccurrenceImportsOnce() {
  const htmlWithDuplicateOccurrence = [
    "<p>Intro paragraph.</p>",
    '<img src="https://wp.example.com/a-576x1024.jpg" alt="" class="wp-image-111"/>',
    "<p>Middle.</p>",
    '<img src="https://wp.example.com/a-576x1024.jpg" alt="" class="wp-image-111"/>',
    "<p>Final paragraph.</p>",
  ].join("\n");
  const currentForThisContent: ArticleContentPayload = {
    version: 1,
    blocks: [
      { id: "a", type: "intro", text: "Intro paragraph." },
      { id: "b", type: "text", text: "Middle." },
      { id: "c", type: "text", text: "Final paragraph." },
    ],
  };
  const harness = createHarness({ initialContentJson: currentForThisContent });
  const result = await runStrictArticleMediaReplay(
    baseInput(harness, {
      rawContent: htmlWithDuplicateOccurrence,
      featuredAttachmentId: 111,
      inlineAttachmentAllowlist: [111],
      current: { contentJson: currentForThisContent, coverImageId: null },
    }),
  );

  assert.equal(result.status, "APPLIED");
  if (result.status !== "APPLIED") return;
  assert.equal(harness.importCalls.length, 1, "one occurrence's worth of download calls — the duplicate is never re-downloaded");
  assert.deepEqual(result.importedAttachmentIds, [111]);

  const finalBlocks = (harness.getArticleState().contentJson as ArticleContentPayload).blocks;
  const imageBlocks = finalBlocks.filter((b): b is Extract<ArticleBlockMvp, { type: "image" }> => b.type === "image");
  assert.equal(imageBlocks.length, 2, "both occurrences are preserved as separate image blocks in contentJson");
  assert.ok(imageBlocks.every((b) => b.mediaId === imageBlocks[0].mediaId), "both occurrences reference the same single imported MediaAsset id");
}

// ---------------------------------------------------------------------------
// Self-review: D. Idempotency edge cases
// ---------------------------------------------------------------------------

async function testCoverMismatchPreventsNoopAndFixesCover() {
  // Both attachments already proven and contentJson already matches, but
  // the stored cover points at some other (stale/wrong) MediaAsset id —
  // must NOT be treated as NOOP; must proceed to correct the cover.
  const alreadySyncedContent: ArticleContentPayload = {
    version: 1,
    blocks: [
      { id: "normalized-content-block-1", type: "intro", text: "Intro paragraph." },
      { id: "normalized-content-block-2", type: "image", mediaId: "existing-media-111" },
      { id: "normalized-content-block-3", type: "image", mediaId: "existing-media-222" },
      { id: "normalized-content-block-4", type: "text", text: "Final paragraph." },
    ],
  };
  // The harness's own internal state (what the fake transaction's
  // findUnique() re-reads) must actually carry the stale cover too, or the
  // *concurrency* guard fires instead of exercising the NOOP-vs-APPLIED
  // decision this test is about.
  const harness = createHarness({ existingMediaIds: [111, 222], initialContentJson: alreadySyncedContent, initialCoverImageId: "some-stale-cover-id" });
  const result = await runStrictArticleMediaReplay(
    baseInput(harness, { current: { contentJson: alreadySyncedContent, coverImageId: "some-stale-cover-id" } }),
  );

  assert.notEqual(result.status, "NOOP_ALREADY_SYNCED", "a cover mismatch must never short-circuit to NOOP");
  assert.equal(result.status, "APPLIED");
  if (result.status !== "APPLIED") return;
  assert.equal(result.coverMediaId, "existing-media-111", "cover is corrected to the proven attachment's MediaAsset id");
  assert.equal(harness.importCalls.length, 0, "still zero downloads — everything was already proven, only the cover field itself needed fixing");
}

async function testDanglingLineageTargetIsNotSilentlyReused() {
  // PR #68 review, P1 #3: lineage row exists (isActive) for attachment 111,
  // but its target MediaAsset no longer exists (e.g. deleted) — this is a
  // distinct DANGLING_ACTIVE_LINEAGE state, never conflated with either
  // "no lineage" (which would trigger a fresh import) or "reusable"
  // (which would silently trust a broken reference). It must fail closed
  // *before* the importer is ever called — zero downloads, zero new
  // MediaAsset, zero new lineage, zero Article update. Auto-recovery
  // (reactivating or deactivating the stale row) is a separate concern,
  // not attempted by this replay.
  // Single-attachment scenario on purpose (not the base two-attachment
  // ALLOWLIST): with attachment 222 also in play, 222's own — entirely
  // unrelated — fresh import would already happen (sequentially, before
  // 111's dangling state is even reached) and confound the "zero side
  // effects" assertions below. Isolating to exactly one attachment is what
  // makes `importCalls.length === 0` a meaningful proof, not an artifact
  // of import ordering.
  const rawContentSingleImage = [
    "<p>Intro paragraph.</p>",
    '<img src="https://wp.example.com/a-576x1024.jpg" alt="" class="wp-image-111"/>',
    "<p>Final paragraph.</p>",
  ].join("\n");
  const currentForThisContent: ArticleContentPayload = {
    version: 1,
    blocks: [
      { id: "a", type: "intro", text: "Intro paragraph." },
      { id: "b", type: "text", text: "Final paragraph." },
    ],
  };
  // Manually poke a dangling lineage row the harness's normal
  // `existingMediaIds` option wouldn't produce (that option always creates
  // a matching MediaAsset too).
  const danglingHarness = createHarness({ initialContentJson: currentForThisContent });
  const originalPrisma = (danglingHarness.syncer as unknown as { deps: { prisma: { migrationLineage: { findFirst: (...a: unknown[]) => unknown } } } }).deps;
  const priorFindFirst = originalPrisma.prisma.migrationLineage.findFirst;
  originalPrisma.prisma.migrationLineage.findFirst = (async (args: { where: { sourceRecordKey: string } }) => {
    if (args.where.sourceRecordKey === "wordpress-db:attachment:111") {
      return { targetId: "deleted-media-asset-id" };
    }
    return priorFindFirst(args);
  }) as typeof priorFindFirst;

  const result = await runStrictArticleMediaReplay(
    baseInput(danglingHarness, {
      rawContent: rawContentSingleImage,
      featuredAttachmentId: null,
      inlineAttachmentAllowlist: [111],
      current: { contentJson: currentForThisContent, coverImageId: null },
    }),
  );

  assert.equal(result.status, "FAILED");
  if (result.status !== "FAILED") return;
  assert.equal(result.failures.length, 1);
  assert.equal(result.failures[0].attachmentId, 111);
  assert.equal(result.failures[0].code, "ARTICLE_MEDIA_DANGLING_LINEAGE");
  // importCalls is the only place either a new MediaAsset or a new
  // lineage row is ever created in this harness (see mediaImporterFactory/
  // lineageWriter above) — zero import calls transitively proves zero new
  // MediaAsset and zero new lineage, not just zero downloads.
  assert.equal(danglingHarness.importCalls.length, 0, "the importer must never be called for a dangling-lineage attachment — no download, no new MediaAsset, no new lineage");
  assert.equal(danglingHarness.updateCalls.length, 0, "Article is never touched");
}

async function testGenuineConcurrentLineageConflictOnFreshImportSurfacesAsFailure() {
  // Distinct from the dangling-lineage case above (which is now caught
  // *before* any importer call, via `getExistingAttachmentLineageState()`
  // itself): this is a genuine *race* — `findFirst()` sees no lineage row
  // at all (state NO_LINEAGE, correctly proceeds to a fresh import), but
  // by the time `MediaImportWriter`'s `createLineage()` call actually runs,
  // some other concurrent process has already inserted a conflicting
  // active row — the real `MigrationLineageWriter` throws a deterministic
  // conflict for exactly this (see its doc comment). Even though this
  // wasn't detectable in the upfront preflight, it must still surface as
  // an explicit FAILED outcome for that attachment, never a silently-
  // assumed success.
  const harness = createHarness();
  const deps = (harness.syncer as unknown as { deps: { lineageWriter: { createLineage: (...a: unknown[]) => unknown } } }).deps;
  const priorCreateLineage = deps.lineageWriter.createLineage;
  deps.lineageWriter.createLineage = (async (input: { sourceRecordKey: string }) => {
    if (input.sourceRecordKey === "wordpress-db:attachment:222") {
      throw new Error("Unique constraint violation: an active MigrationLineage row already exists for this key.");
    }
    return priorCreateLineage(input);
  }) as typeof deps.lineageWriter.createLineage;

  const result = await runStrictArticleMediaReplay(baseInput(harness));

  assert.equal(result.status, "FAILED");
  if (result.status !== "FAILED") return;
  assert.equal(result.failures.length, 1);
  assert.equal(result.failures[0].attachmentId, 222);
  assert.equal(result.failures[0].code, "ARTICLE_MEDIA_DOWNLOAD_FAILED");
  assert.equal(harness.updateCalls.length, 0, "Article is never touched — the conflict is surfaced, not silently swallowed");
}

// ---------------------------------------------------------------------------
// Self-review: E. Concurrency
// ---------------------------------------------------------------------------

async function testConcurrentArticleChangeDuringReplayRefusesAndRollsBack() {
  const harness = createHarness();
  // Simulate an external write landing between preflight and the atomic
  // apply: the transaction's own findUnique() sees a different cover than
  // what `current` (captured at preflight time) says.
  const txAny = harness.prismaWithTx as unknown as { article: { findUnique: () => Promise<{ contentJson: ArticleContentPayload; coverImageId: string | null }> } };
  const originalFindUnique = txAny.article.findUnique;
  txAny.article.findUnique = async () => {
    const live = await originalFindUnique();
    return { ...live, coverImageId: "concurrently-changed-by-someone-else" };
  };

  const result = await runStrictArticleMediaReplay(baseInput(harness));

  assert.equal(result.status, "REFUSED");
  if (result.status !== "REFUSED") return;
  assert.equal(result.code, "ARTICLE_MEDIA_REPLAY_TARGET_CHANGED_DURING_REPLAY");
  assert.equal(harness.updateCalls.length, 0, "the transaction never actually commits an update when the concurrency guard fires — the replay's own write is what's rolled back, not the concurrent change");
}

async function main() {
  await testFeaturedCoverAbsentFromContentStillSucceeds();
  await testSuccessfulReplayAppliesOnlyContentJsonAndCover();
  await testIdempotentReplayIsNoop();
  await testUnexpectedAttachmentOutsideAllowlistRefuses();
  await testContentDivergenceRefusesBeforeImport();
  await testMissingAttachmentFailsBeforeArticleUpdate();
  await testDownloadFailureLeavesArticleUntouched();
  await testExistingLineageIsReusedWithoutNewDownload();
  await testDivergenceDetectsReorderedBlocks();
  await testDivergenceDetectsChangedSemanticField();
  await testDivergenceIgnoresOnlyIdAndUndefinedKeys();
  await testAmbiguousImageWithoutAttachmentIdRefusesBeforeImport();
  await testDuplicateAttachmentOccurrenceImportsOnce();
  await testCoverMismatchPreventsNoopAndFixesCover();
  await testDanglingLineageTargetIsNotSilentlyReused();
  await testGenuineConcurrentLineageConflictOnFreshImportSurfacesAsFailure();
  await testConcurrentArticleChangeDuringReplayRefusesAndRollsBack();
}

main()
  .then(() => {
    console.log("strictArticleMediaReplay tests: OK");
  })
  .catch((error) => {
    console.error("strictArticleMediaReplay tests: FAILED", error);
    process.exitCode = 1;
  });
