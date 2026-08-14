import assert from "node:assert/strict";

import { ArticleFullMediaSyncer } from "./ArticleFullMediaSyncer";
import type { NormalizedArticleCandidate } from "./buildArticleCreateDraft";
import type { WordPressAttachmentRow } from "../../adapters/wordpress-db/types";

function attachment(id: number, overrides: Partial<WordPressAttachmentRow> = {}): WordPressAttachmentRow {
  return {
    ID: id,
    post_title: `Attachment ${id}`,
    post_name: `attachment-${id}`,
    post_mime_type: "image/jpeg",
    guid: `https://wp.example.com/${id}.jpg`,
    post_parent: 201,
    attached_file: null,
    ...overrides,
  };
}

function candidate(overrides: Partial<NormalizedArticleCandidate> = {}): NormalizedArticleCandidate {
  return {
    title: "Hello Article",
    slug: "hello-article",
    content: '<p>Hello <img class="wp-image-111" src="https://wp.example.com/111.jpg" /></p>',
    excerpt: "Hello",
    status: "publish",
    publishedAt: "2026-01-01 00:00:00",
    modifiedAt: "2026-01-02 00:00:00",
    seo: {
      title: null,
      description: null,
      focusKeyword: null,
      canonicalUrl: null,
      robots: null,
      ogTitle: null,
      ogDescription: null,
    },
    featuredImageAttachmentId: 555,
    inlineImageAttachmentIds: [111],
    oldSlugs: [],
    hasElementorContent: false,
    hasWebStoryContent: false,
    sourceTerms: [],
    rawMeta: {},
    ...overrides,
  };
}

function createHarness(options: { failIds?: readonly number[]; missingIds?: readonly number[]; existingIds?: readonly number[] } = {}) {
  const assets = new Map<string, { id: string; publicUrl: string; deletedAt: null }>();
  const lineages = new Map<string, string>();
  const articleUpdates: Array<Record<string, unknown>> = [];
  let importCalls = 0;

  for (const id of options.existingIds ?? []) {
    assets.set(`media-${id}`, { id: `media-${id}`, publicUrl: `/uploads/${id}.webp`, deletedAt: null });
    lineages.set(`wordpress-db:attachment:${id}`, `media-${id}`);
  }

  const syncer = new ArticleFullMediaSyncer({
    prisma: {
      article: {
        findUnique: async () => ({ contentJson: null, coverImageId: null }),
        update: async (args: { data: Record<string, unknown> }) => {
          articleUpdates.push(args.data);
          return {};
        },
      } as never,
      mediaAsset: {
        findFirst: async (args: { where: { id?: string } }) => (args.where.id ? assets.get(args.where.id) ?? null : null),
      } as never,
      migrationLineage: {
        findFirst: async (args: { where: { sourceRecordKey: string } }) => {
          const mediaId = lineages.get(args.where.sourceRecordKey);
          return mediaId ? { targetId: mediaId } : null;
        },
      } as never,
    },
    attachmentResolver: {
      async getAttachmentsByIds(ids) {
        const map = new Map<number, WordPressAttachmentRow>();
        for (const id of ids) {
          if (options.missingIds?.includes(id)) continue;
          map.set(id, attachment(id));
        }
        return map;
      },
    },
    mediaImporterFactory: () => ({
      importFromUrl: async (input: { sourceRecordKey: string }) => {
        const id = Number(input.sourceRecordKey.split(":").pop());
        importCalls += 1;
        if (options.failIds?.includes(id)) throw new Error("failed to download");
        const mediaId = `media-${id}`;
        const publicUrl = `/uploads/${id}.webp`;
        assets.set(mediaId, { id: mediaId, publicUrl, deletedAt: null });
        return { mediaId, publicUrl, storageKey: `k-${id}` };
      },
    }),
    lineageWriter: {
      async createLineage(input: { sourceRecordKey: string; targetId: string }) {
        lineages.set(input.sourceRecordKey, input.targetId);
        return { lineageId: `lin-${input.targetId}`, sourceRecordKey: input.sourceRecordKey, targetType: "MEDIA_ASSET", targetId: input.targetId };
      },
    } as never,
    attachmentImportCoordinator: {
      async withClaim(_identity, operation) {
        return { acquired: true, value: await operation() };
      },
    },
  });

  return { syncer, articleUpdates, getImportCalls: () => importCalls };
}

async function main() {
{
  const { syncer, articleUpdates } = createHarness();
  const empty = await syncer.sync({
    articleId: "article-1",
    candidate: candidate({ featuredImageAttachmentId: null, inlineImageAttachmentIds: [] }),
    ownerUserId: "user-1",
    sourceId: "src-1",
    sourceHash: "hash",
    sourceRecordKey: "wordpress-db:post:201",
  });
  assert.deepEqual(empty.warnings, []);
  assert.equal(articleUpdates.length, 0);
}

{
  const { syncer, articleUpdates } = createHarness();
  const result = await syncer.sync({
    articleId: "article-1",
    candidate: candidate(),
    ownerUserId: null,
    sourceId: "src-1",
    sourceHash: "hash",
    sourceRecordKey: "wordpress-db:post:201",
  });
  assert.ok(result.warnings.some((warning) => warning.code === "ARTICLE_MEDIA_OWNER_MISSING"));
  assert.equal(articleUpdates.length, 0);
}

{
  const { syncer, articleUpdates, getImportCalls } = createHarness({ missingIds: [111], failIds: [] });
  const result = await syncer.sync({
    articleId: "article-1",
    candidate: candidate(),
    ownerUserId: "user-1",
    sourceId: "src-1",
    sourceHash: "hash",
    sourceRecordKey: "wordpress-db:post:201",
  });
  assert.equal(getImportCalls(), 1);
  assert.ok(result.warnings.some((warning) => warning.code === "ARTICLE_MEDIA_ATTACHMENT_MISSING" || warning.code === "ARTICLE_MEDIA_PARTIAL"));
  assert.equal(articleUpdates[0]?.coverImageId, "media-555");
}

{
  const { syncer, getImportCalls } = createHarness({ existingIds: [555, 111] });
  await syncer.sync({
    articleId: "article-1",
    candidate: candidate(),
    ownerUserId: "user-1",
    sourceId: "src-1",
    sourceHash: "hash",
    sourceRecordKey: "wordpress-db:post:201",
  });
  await syncer.sync({
    articleId: "article-1",
    candidate: candidate(),
    ownerUserId: "user-1",
    sourceId: "src-1",
    sourceHash: "hash",
    sourceRecordKey: "wordpress-db:post:201",
  });
  assert.equal(getImportCalls(), 0, "rerun must reuse MediaAsset lineage");
}

console.log("ArticleFullMediaSyncer tests: OK");
}

void main();
