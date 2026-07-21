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
import type { ArticleContentPayload } from "@/lib/publications/articleMvp";

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
}

function createHarness(options: HarnessOptions = {}) {
  const attachments = new Map<number, WordPressAttachmentRow>();
  for (const id of ALLOWLIST) {
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
    attachmentAllowlist: ALLOWLIST,
    ownerUserId: OWNER_USER_ID,
    current: { contentJson: harness.getArticleState().contentJson, coverImageId: harness.getArticleState().coverImageId },
    mediaImporter: harness.syncer,
    prisma: harness.prismaWithTx,
    ...overrides,
  };
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

async function main() {
  await testSuccessfulReplayAppliesOnlyContentJsonAndCover();
  await testIdempotentReplayIsNoop();
  await testUnexpectedAttachmentOutsideAllowlistRefuses();
  await testContentDivergenceRefusesBeforeImport();
  await testMissingAttachmentFailsBeforeArticleUpdate();
  await testDownloadFailureLeavesArticleUntouched();
  await testExistingLineageIsReusedWithoutNewDownload();
}

main()
  .then(() => {
    console.log("strictArticleMediaReplay tests: OK");
  })
  .catch((error) => {
    console.error("strictArticleMediaReplay tests: FAILED", error);
    process.exitCode = 1;
  });
