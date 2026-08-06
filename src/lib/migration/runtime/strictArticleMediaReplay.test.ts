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
import { isDeepStrictEqual } from "node:util";

import {
  ARTICLE_MEDIA_TARGET_ROLE,
  ArticleMediaReplaySyncer,
  type ArticleMediaAttachmentImportCoordinator,
  type ArticleMediaReplaySyncerPrismaClient,
} from "../commit/article/ArticleMediaReplaySyncer";
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

function persistedContentJson(contentJson: ArticleContentPayload): ArticleContentPayload {
  return JSON.parse(JSON.stringify(contentJson)) as ArticleContentPayload;
}

interface HarnessOptions {
  missingAttachmentIds?: readonly number[];
  failImportIds?: readonly number[];
  existingMediaIds?: readonly number[];
  initialCoverImageId?: string | null;
  initialContentJson?: ArticleContentPayload;
  /** Attachment ids beyond ALLOWLIST the harness's WordPress attachment resolver should also know about — e.g. a featured/cover image that never appears inline in the content. */
  extraAttachmentIds?: readonly number[];
  /** Simulates `tx.mediaUsage.createMany` throwing inside the same transaction as the Article CAS apply. */
  failMediaUsageCreate?: boolean;
}

function createHarness(options: HarnessOptions = {}) {
  const attachments = new Map<number, WordPressAttachmentRow>();
  for (const id of [...ALLOWLIST, ...(options.extraAttachmentIds ?? [])]) {
    if (!options.missingAttachmentIds?.includes(id)) attachments.set(id, attachment(id));
  }

  const mediaAssets = new Map<string, { id: string; publicUrl: string; deletedAt: null }>();
  const lineages = new Map<string, string>(); // sourceRecordKey -> mediaAssetId
  const importCalls: string[] = [];
  let importerFactoryCalls = 0;
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

  const mediaImporterFactory = (): MediaImporterLike => {
    importerFactoryCalls += 1;
    return {
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
    };
  };

  const lineageWriter: MediaLineageWriterLike = {
    createLineage: async (input) => {
      lineages.set(input.sourceRecordKey, input.targetId);
      return { lineageId: `lineage-${input.sourceRecordKey}`, sourceRecordKey: input.sourceRecordKey, targetType: input.targetType, targetId: input.targetId };
    },
  };

  const activeClaims = new Set<string>();
  const attachmentImportCoordinator: ArticleMediaAttachmentImportCoordinator = {
    withClaim: async (identity, operation) => {
      const key = JSON.stringify([identity.sourceId, identity.targetRole, identity.sourceRecordKey]);
      if (activeClaims.has(key)) return { acquired: false };
      activeClaims.add(key);
      try {
        return { acquired: true, value: await operation() };
      } finally {
        activeClaims.delete(key);
      }
    },
  };

  const syncer = new ArticleMediaReplaySyncer({
    prisma,
    attachmentResolver: { getAttachmentsByIds: async (ids) => new Map(ids.filter((id) => attachments.has(id)).map((id) => [id, attachments.get(id)!])) },
    mediaImporterFactory,
    lineageWriter,
    attachmentImportCoordinator,
  });

  let articleState = {
    contentJson: persistedContentJson(options.initialContentJson ?? CURRENT_TEXT_ONLY_CONTENT),
    coverImageId: options.initialCoverImageId ?? null,
  };
  const updateCalls: { data: Record<string, unknown> }[] = [];
  const updateManyAttempts: { where: Record<string, unknown>; data: Record<string, unknown> }[] = [];

  let mediaUsageRows: { mediaId: string; entityType: string; entityId: string; field: string }[] = [];
  const mediaUsageCreateManyCalls: { data: { mediaId: string; entityType: string; entityId: string; field: string }[] }[] = [];

  const txClient: StrictArticleMediaReplayTxClient = {
    article: {
      updateMany: (async (args: {
        where: { id: string; coverImageId: string | null; contentJson: { equals: ArticleContentPayload } };
        data: { contentJson: ArticleContentPayload; coverImageId: string | null };
      }) => {
        updateManyAttempts.push({ where: args.where, data: args.data });
        const matches =
          args.where.id === ARTICLE_ID &&
          args.where.coverImageId === articleState.coverImageId &&
          isDeepStrictEqual(args.where.contentJson.equals, articleState.contentJson);
        if (!matches) return { count: 0 };
        updateCalls.push({ data: args.data });
        articleState = {
          contentJson: persistedContentJson(args.data.contentJson),
          coverImageId: args.data.coverImageId,
        };
        return { count: 1 };
      }) as unknown as StrictArticleMediaReplayTxClient["article"]["updateMany"],
    },
    mediaUsage: {
      deleteMany: (async (args: { where: { entityType: string; entityId: string; field: string } }) => {
        const before = mediaUsageRows.length;
        mediaUsageRows = mediaUsageRows.filter(
          (r) => !(r.entityType === args.where.entityType && r.entityId === args.where.entityId && r.field === args.where.field),
        );
        return { count: before - mediaUsageRows.length };
      }) as unknown as StrictArticleMediaReplayTxClient["mediaUsage"]["deleteMany"],
      createMany: (async (args: { data: { mediaId: string; entityType: string; entityId: string; field: string }[] }) => {
        mediaUsageCreateManyCalls.push(args);
        if (options.failMediaUsageCreate) {
          throw new Error("Simulated MediaUsage.createMany failure");
        }
        mediaUsageRows.push(...args.data);
        return { count: args.data.length };
      }) as unknown as StrictArticleMediaReplayTxClient["mediaUsage"]["createMany"],
    },
  };

  const prismaWithTx: StrictArticleMediaReplayPrismaClient = {
    ...txClient,
    $transaction: async <T>(fn: (tx: StrictArticleMediaReplayTxClient) => Promise<T>): Promise<T> => {
      // Real Postgres rolls back only THIS transaction's own writes on
      // throw — never a concurrent transaction's already-committed write
      // that happened to land inside our window (that's exactly what the
      // CAS-race tests model via `harness.setArticleState()` from outside
      // `txClient`). So rollback-on-throw here is scoped to state this very
      // `fn(txClient)` invocation itself mutated (tracked via whether our
      // own `updateCalls` grew), not a blanket "restore to whatever it was
      // before `fn` ran".
      const articleSnapshotBeforeAttempt = articleState;
      const usageSnapshotBeforeAttempt = mediaUsageRows;
      const updateCallsBeforeAttempt = updateCalls.length;
      try {
        return await fn(txClient);
      } catch (error) {
        if (updateCalls.length > updateCallsBeforeAttempt) {
          articleState = articleSnapshotBeforeAttempt;
          mediaUsageRows = usageSnapshotBeforeAttempt;
        }
        throw error;
      }
    },
  };

  return {
    syncer,
    prismaWithTx,
    importCalls,
    getImporterFactoryCalls: () => importerFactoryCalls,
    getArticleState: () => articleState,
    setArticleState: (next: { contentJson: ArticleContentPayload; coverImageId: string | null }) => {
      articleState = { contentJson: persistedContentJson(next.contentJson), coverImageId: next.coverImageId };
    },
    getMediaAssetCount: () => mediaAssets.size,
    getLineageCount: () => lineages.size,
    updateCalls,
    updateManyAttempts,
    getMediaUsageRows: () => mediaUsageRows,
    mediaUsageCreateManyCalls,
    attachmentImportCoordinator,
  };
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

  // The public media-file gate (hasPublishedPublicLinkage) trusts MediaUsage
  // for inline Article media — a successful replay must leave exactly one
  // usage row per inline image block's resolved mediaId, tagged with the
  // dedicated content field, in the very same transaction as the Article write.
  const usageRows = harness.getMediaUsageRows();
  const inlineMediaIds = (finalState.contentJson as ArticleContentPayload).blocks
    .filter((b): b is Extract<ArticleBlockMvp, { type: "image" }> => b.type === "image")
    .map((b) => b.mediaId);
  assert.equal(usageRows.length, inlineMediaIds.length, "one MediaUsage row per inline image block");
  assert.deepEqual(usageRows.map((r) => r.mediaId).sort(), [...inlineMediaIds].sort());
  assert.ok(usageRows.every((r) => r.entityType === "ARTICLE" && r.entityId === ARTICLE_ID && r.field === "content"));
}

async function testCoverOnlyArticleCreatesNoContentUsage() {
  // No inline images at all — only a featuredAttachmentId. See
  // strictArticleMediaReplay.ts's own doc comment (PR #68 P1 #1): a cover
  // frequently never appears inline, and that must remain a fully valid,
  // APPLIED case that simply never touches content-field MediaUsage.
  const rawContentWithoutImages = ["<p>Intro paragraph.</p>", "<p>Final paragraph.</p>"].join("\n");
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
      rawContent: rawContentWithoutImages,
      featuredAttachmentId: 999,
      inlineAttachmentAllowlist: [],
      current: { contentJson: currentForThisContent, coverImageId: null },
    }),
  );

  assert.equal(result.status, "APPLIED");
  if (result.status !== "APPLIED") return;
  assert.equal(result.imageBlockCount, 0);
  assert.ok(result.coverMediaId, "cover was still resolved and applied");
  assert.deepEqual(harness.getMediaUsageRows(), [], "a cover-only Article creates zero content-field MediaUsage rows");
}

async function testMediaUsageFailureRollsBackArticleUpdate() {
  const harness = createHarness({ failMediaUsageCreate: true });
  await assert.rejects(() => runStrictArticleMediaReplay(baseInput(harness)), /Simulated MediaUsage.createMany failure/);

  assert.equal(harness.updateManyAttempts.length, 1, "the CAS was attempted and matched");
  assert.deepEqual(harness.getArticleState(), { contentJson: CURRENT_TEXT_ONLY_CONTENT, coverImageId: null }, "Article contentJson/coverImageId rolled back to their pre-replay values despite the CAS having matched");
  assert.deepEqual(harness.getMediaUsageRows(), [], "no MediaUsage row survives the rollback");
}

async function testIdempotentReplayIsNoop() {
  const harness = createHarness();
  const first = await runStrictArticleMediaReplay(baseInput(harness));
  assert.equal(first.status, "APPLIED");

  const usageRowsAfterFirst = harness.getMediaUsageRows();
  const createManyCallsAfterFirst = harness.mediaUsageCreateManyCalls.length;
  const importCallsAfterFirst = harness.importCalls.length;
  const second = await runStrictArticleMediaReplay(
    baseInput(harness, { current: { contentJson: harness.getArticleState().contentJson, coverImageId: harness.getArticleState().coverImageId } }),
  );

  assert.equal(second.status, "NOOP_ALREADY_SYNCED");
  assert.equal(harness.importCalls.length, importCallsAfterFirst, "zero new downloads on repeat replay");
  assert.equal(harness.updateCalls.length, 1, "no second Article update — still just the one from the first run");
  assert.equal(harness.updateManyAttempts.length, 1, "NOOP replay never attempts a second CAS update");
  assert.equal(harness.mediaUsageCreateManyCalls.length, createManyCallsAfterFirst, "NOOP never re-enters the transaction, so MediaUsage sync is not called again");
  assert.deepEqual(harness.getMediaUsageRows(), usageRowsAfterFirst, "MediaUsage rows from the first run are left exactly as they were");
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
  assert.equal(harness.updateManyAttempts.length, 0, "failed media import never reaches Article CAS");
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
  // PR #68 review, P1 #3: attachment 111 has no lineage and appears first,
  // while attachment 222 has an active lineage whose target MediaAsset no
  // longer exists. The whole batch must fail its read-only preflight before
  // the fresh attachment can be imported.
  // Manually poke a dangling lineage row the harness's normal
  // `existingMediaIds` option wouldn't produce (that option always creates
  // a matching MediaAsset too).
  const danglingHarness = createHarness();
  const originalPrisma = (danglingHarness.syncer as unknown as { deps: { prisma: { migrationLineage: { findFirst: (...a: unknown[]) => unknown } } } }).deps;
  const priorFindFirst = originalPrisma.prisma.migrationLineage.findFirst;
  originalPrisma.prisma.migrationLineage.findFirst = (async (args: { where: { sourceRecordKey: string } }) => {
    if (args.where.sourceRecordKey === "wordpress-db:attachment:222") {
      return { targetId: "deleted-media-asset-id" };
    }
    return priorFindFirst(args);
  }) as typeof priorFindFirst;

  const initialArticleState = structuredClone(danglingHarness.getArticleState());
  const initialMediaAssetCount = danglingHarness.getMediaAssetCount();
  const initialLineageCount = danglingHarness.getLineageCount();
  const result = await runStrictArticleMediaReplay(baseInput(danglingHarness));

  assert.equal(result.status, "FAILED");
  if (result.status !== "FAILED") return;
  assert.equal(result.code, "ARTICLE_MEDIA_DANGLING_LINEAGE");
  assert.equal(result.failures.length, 1);
  assert.equal(result.failures[0].attachmentId, 222);
  assert.equal(result.failures[0].code, "ARTICLE_MEDIA_DANGLING_LINEAGE");
  assert.deepEqual(result.failures[0].details, { attachmentId: 222, lineageTargetId: "deleted-media-asset-id" });
  assert.equal(danglingHarness.importCalls.length, 0, "the fresh attachment before the dangling attachment must not be imported");
  assert.equal(danglingHarness.getMediaAssetCount() - initialMediaAssetCount, 0, "no MediaAsset created");
  assert.equal(danglingHarness.getLineageCount() - initialLineageCount, 0, "no MEDIA_ASSET lineage created");
  assert.equal(danglingHarness.updateCalls.length, 0, "Article is never touched");
  assert.equal(danglingHarness.updateManyAttempts.length, 0, "dangling-lineage preflight never reaches Article CAS");
  assert.deepEqual(danglingHarness.getArticleState(), initialArticleState, "Article contentJson and coverImageId remain unchanged");
}

async function testNullTargetLineageFailsWholeBatchPreflight() {
  const harness = createHarness();
  const deps = (harness.syncer as unknown as { deps: { prisma: { migrationLineage: { findFirst: (...a: unknown[]) => unknown } } } }).deps;
  const priorFindFirst = deps.prisma.migrationLineage.findFirst;
  deps.prisma.migrationLineage.findFirst = (async (args: { where: { sourceRecordKey: string } }) => {
    if (args.where.sourceRecordKey === "wordpress-db:attachment:222") return { targetId: null };
    return priorFindFirst(args);
  }) as typeof priorFindFirst;
  const initialState = structuredClone(harness.getArticleState());
  const initialMediaAssetCount = harness.getMediaAssetCount();
  const initialLineageCount = harness.getLineageCount();

  const result = await runStrictArticleMediaReplay(baseInput(harness));

  assert.equal(result.status, "FAILED");
  if (result.status !== "FAILED") return;
  assert.equal(result.code, "ARTICLE_MEDIA_DANGLING_LINEAGE");
  assert.equal(result.failures.length, 1);
  assert.equal(result.failures[0].attachmentId, 222);
  assert.equal(result.failures[0].code, "ARTICLE_MEDIA_DANGLING_LINEAGE");
  assert.deepEqual(result.failures[0].details, { attachmentId: 222, lineageTargetId: null });
  assert.equal(harness.getImporterFactoryCalls(), 0);
  assert.equal(harness.importCalls.length, 0);
  assert.equal(harness.getMediaAssetCount() - initialMediaAssetCount, 0);
  assert.equal(harness.getLineageCount() - initialLineageCount, 0);
  assert.equal(harness.updateManyAttempts.length, 0);
  assert.deepEqual(harness.getArticleState(), initialState);
}

async function testNullTargetLineageFoundUnderClaimDoesNotImport() {
  const harness = createHarness();
  const deps = (harness.syncer as unknown as { deps: { prisma: { migrationLineage: { findFirst: (...a: unknown[]) => unknown } } } }).deps;
  const priorFindFirst = deps.prisma.migrationLineage.findFirst;
  let attachmentLookupCount = 0;
  deps.prisma.migrationLineage.findFirst = (async (args: { where: { sourceRecordKey: string } }) => {
    if (args.where.sourceRecordKey === "wordpress-db:attachment:222") {
      attachmentLookupCount += 1;
      return attachmentLookupCount === 1 ? null : { targetId: null };
    }
    return priorFindFirst(args);
  }) as typeof priorFindFirst;

  const preflight = await harness.syncer.checkAttachmentLineageStates({ ids: [222], sourceId: SOURCE_ID });
  assert.deepEqual(preflight.get(222), { state: "NO_LINEAGE" });
  const outcome = (
    await harness.syncer.resolveAndImportAttachments({
      ids: [222],
      ownerUserId: OWNER_USER_ID,
      sourceId: SOURCE_ID,
      sourceHash: SOURCE_HASH,
      runId: null,
      recordId: null,
    })
  ).get(222);

  assert.equal(outcome?.ok, false);
  if (outcome?.ok === false) {
    assert.equal(outcome.code, "ARTICLE_MEDIA_DANGLING_LINEAGE");
    assert.deepEqual(outcome.details, { attachmentId: 222, lineageTargetId: null });
  }
  assert.equal(harness.getImporterFactoryCalls(), 0);
  assert.equal(harness.importCalls.length, 0);
  assert.equal(harness.getMediaAssetCount(), 0);
  assert.equal(harness.getLineageCount(), 0);
}

async function testConcurrentAttachmentImportIsSerializedWithoutOrphan() {
  const harness = createHarness();
  let markImportEntered!: () => void;
  let releaseImport!: () => void;
  const importEntered = new Promise<void>((resolve) => {
    markImportEntered = resolve;
  });
  const importRelease = new Promise<void>((resolve) => {
    releaseImport = resolve;
  });
  const deps = (harness.syncer as unknown as { deps: { mediaImporterFactory: (ownerUserId: string) => MediaImporterLike } }).deps;
  const originalFactory = deps.mediaImporterFactory;
  deps.mediaImporterFactory = (ownerUserId) => {
    const importer = originalFactory(ownerUserId);
    const originalImport = importer.importFromUrl.bind(importer);
    return {
      ...importer,
      importFromUrl: async (input) => {
        if (input.sourceRecordKey === "wordpress-db:attachment:111") {
          markImportEntered();
          await importRelease;
        }
        return originalImport(input);
      },
    };
  };
  const input = {
    ids: [111],
    ownerUserId: OWNER_USER_ID,
    sourceId: SOURCE_ID,
    sourceHash: SOURCE_HASH,
    runId: null,
    recordId: null,
  };
  const initialMediaAssetCount = harness.getMediaAssetCount();
  const initialLineageCount = harness.getLineageCount();

  const invocationA = harness.syncer.resolveAndImportAttachments(input);
  await importEntered;
  const invocationB = await harness.syncer.resolveAndImportAttachments(input);
  const busy = invocationB.get(111);
  assert.equal(busy?.ok, false);
  if (busy?.ok === false) assert.equal(busy.code, "ARTICLE_MEDIA_ATTACHMENT_IMPORT_BUSY");
  assert.equal(harness.importCalls.length, 0, "loser returns BUSY before a second importer call; winner is paused before its one call");
  assert.equal(harness.getImporterFactoryCalls(), 1, "loser does not create an importer");

  releaseImport();
  const winner = (await invocationA).get(111);
  assert.equal(winner?.ok, true);
  if (winner?.ok === true) assert.equal(winner.reused, false);

  const retry = (await harness.syncer.resolveAndImportAttachments(input)).get(111);
  assert.equal(retry?.ok, true);
  if (retry?.ok === true) {
    assert.equal(retry.reused, true);
    assert.equal(retry.mediaId, winner?.ok === true ? winner.mediaId : null);
  }
  const mediaAssetDelta = harness.getMediaAssetCount() - initialMediaAssetCount;
  const lineageDelta = harness.getLineageCount() - initialLineageCount;
  assert.equal(harness.importCalls.length, 1, "exactly one upload across winner, loser, and retry");
  assert.equal(mediaAssetDelta, 1);
  assert.equal(lineageDelta, 1);
  assert.equal(mediaAssetDelta - lineageDelta, 0, "no orphan MediaAsset delta");
}

async function testAttachmentClaimsAreKeyedAndReleasedAfterFailure() {
  const harness = createHarness({ failImportIds: [111] });
  let releaseFirst!: () => void;
  const holdFirst = new Promise<void>((resolve) => {
    releaseFirst = resolve;
  });
  let markFirstEntered!: () => void;
  const firstEntered = new Promise<void>((resolve) => {
    markFirstEntered = resolve;
  });
  const firstClaim = harness.attachmentImportCoordinator.withClaim(
    { sourceId: SOURCE_ID, targetRole: ARTICLE_MEDIA_TARGET_ROLE, sourceRecordKey: "wordpress-db:attachment:111" },
    async () => {
      markFirstEntered();
      await holdFirst;
      return "first";
    },
  );
  await firstEntered;
  const differentAttachment = await harness.attachmentImportCoordinator.withClaim(
    { sourceId: SOURCE_ID, targetRole: ARTICLE_MEDIA_TARGET_ROLE, sourceRecordKey: "wordpress-db:attachment:222" },
    async () => "second",
  );
  assert.deepEqual(differentAttachment, { acquired: true, value: "second" }, "different attachment id is not blocked by a global lock");
  releaseFirst();
  await firstClaim;

  const input = {
    ids: [111],
    ownerUserId: OWNER_USER_ID,
    sourceId: SOURCE_ID,
    sourceHash: SOURCE_HASH,
    runId: null,
    recordId: null,
  };
  const firstFailure = (await harness.syncer.resolveAndImportAttachments(input)).get(111);
  const retryFailure = (await harness.syncer.resolveAndImportAttachments(input)).get(111);
  assert.equal(firstFailure?.ok, false);
  assert.equal(retryFailure?.ok, false);
  if (retryFailure?.ok === false) assert.notEqual(retryFailure.code, "ARTICLE_MEDIA_ATTACHMENT_IMPORT_BUSY", "failed import releases its claim for retry");
}

// ---------------------------------------------------------------------------
// Self-review: E. Concurrency
// ---------------------------------------------------------------------------

async function testConcurrentArticleChangeInCasWindowIsNotOverwritten() {
  const harness = createHarness();
  const editorContent: ArticleContentPayload = {
    version: 1,
    blocks: [{ id: "editor-block", type: "text", text: "Manual edit committed in the CAS race window." }],
  };
  const editorCoverImageId = "editor-cover-media-id";
  const article = harness.prismaWithTx.article as unknown as {
    updateMany: StrictArticleMediaReplayTxClient["article"]["updateMany"];
  };
  const originalUpdateMany = article.updateMany;
  article.updateMany = (async (...args: Parameters<typeof originalUpdateMany>) => {
    // The replay has completed preflight and media import and is now about
    // to issue its CAS. Commit the editor's state immediately before the
    // predicate is evaluated to model the exact lost-update race window.
    harness.setArticleState({ contentJson: editorContent, coverImageId: editorCoverImageId });
    return originalUpdateMany(...args);
  }) as unknown as typeof originalUpdateMany;

  const result = await runStrictArticleMediaReplay(baseInput(harness));

  assert.equal(result.status, "REFUSED");
  if (result.status !== "REFUSED") return;
  assert.equal(result.code, "ARTICLE_MEDIA_REPLAY_TARGET_CHANGED_DURING_REPLAY");
  assert.equal(harness.updateManyAttempts.length, 1, "the replay attempts exactly one conditional CAS");
  assert.equal(harness.updateCalls.length, 0, "zero successful Article CAS updates");
  assert.deepEqual(
    harness.getArticleState(),
    { contentJson: editorContent, coverImageId: editorCoverImageId },
    "the editor's contentJson and coverImageId survive; replay payload is not applied",
  );
  assert.deepEqual(harness.getMediaUsageRows(), [], "a failed CAS never reaches the MediaUsage sync");
}

async function testConcurrentContentOnlyChangeFailsCas() {
  const harness = createHarness();
  const editorContent: ArticleContentPayload = {
    version: 1,
    blocks: [{ id: "editor-content-only", type: "text", text: "Content changed while cover stayed the same." }],
  };
  const article = harness.prismaWithTx.article as unknown as {
    updateMany: StrictArticleMediaReplayTxClient["article"]["updateMany"];
  };
  const originalUpdateMany = article.updateMany;
  article.updateMany = (async (...args: Parameters<typeof originalUpdateMany>) => {
    harness.setArticleState({ contentJson: editorContent, coverImageId: null });
    return originalUpdateMany(...args);
  }) as unknown as typeof originalUpdateMany;

  const result = await runStrictArticleMediaReplay(baseInput(harness));

  assert.equal(result.status, "REFUSED");
  if (result.status !== "REFUSED") return;
  assert.equal(result.code, "ARTICLE_MEDIA_REPLAY_TARGET_CHANGED_DURING_REPLAY");
  assert.equal(harness.updateManyAttempts.length, 1);
  assert.equal(harness.updateCalls.length, 0);
  assert.deepEqual(harness.getArticleState(), { contentJson: editorContent, coverImageId: null });
  assert.deepEqual(harness.getMediaUsageRows(), [], "a failed CAS never reaches the MediaUsage sync");
}

async function main() {
  await testFeaturedCoverAbsentFromContentStillSucceeds();
  await testSuccessfulReplayAppliesOnlyContentJsonAndCover();
  await testCoverOnlyArticleCreatesNoContentUsage();
  await testMediaUsageFailureRollsBackArticleUpdate();
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
  await testNullTargetLineageFailsWholeBatchPreflight();
  await testNullTargetLineageFoundUnderClaimDoesNotImport();
  await testConcurrentAttachmentImportIsSerializedWithoutOrphan();
  await testAttachmentClaimsAreKeyedAndReleasedAfterFailure();
  await testConcurrentArticleChangeInCasWindowIsNotOverwritten();
  await testConcurrentContentOnlyChangeFailsCas();
}

main()
  .then(() => {
    console.log("strictArticleMediaReplay tests: OK");
  })
  .catch((error) => {
    console.error("strictArticleMediaReplay tests: FAILED", error);
    process.exitCode = 1;
  });
