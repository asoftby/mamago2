import assert from "node:assert/strict";

import { FullOfferMediaDelegate } from "./FullOfferMediaDelegate";
import { OfferMediaSyncer } from "./OfferMediaSyncer";
import type { WordPressAttachmentRow } from "../../adapters/wordpress-db/types";

function attachment(id: number, overrides: Partial<WordPressAttachmentRow> = {}): WordPressAttachmentRow {
  return {
    ID: id,
    post_title: `Attachment ${id}`,
    post_name: `attachment-${id}`,
    post_mime_type: "image/jpeg",
    guid: `https://wp.example.com/${id}.jpg`,
    post_parent: 1,
    attached_file: null,
    ...overrides,
  };
}

function createHarness(options: { failIds?: readonly number[]; missingIds?: readonly number[]; existingIds?: readonly number[] } = {}) {
  const assets = new Map<string, { id: string; publicUrl: string; deletedAt: null }>();
  const lineages = new Map<string, string>();
  const offerUpdates: Array<{ coverImage: string | null; galleryImages: unknown }> = [];
  let importCalls = 0;

  for (const id of options.existingIds ?? []) {
    assets.set(`media-${id}`, { id: `media-${id}`, publicUrl: `/uploads/${id}.webp`, deletedAt: null });
    lineages.set(`wordpress-db:attachment:${id}`, `media-${id}`);
  }

  const delegate = new FullOfferMediaDelegate({
    prisma: {
      offer: {
        update: async (args: { data: { coverImage: string | null; galleryImages: unknown } }) => {
          offerUpdates.push(args.data);
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
  });

  return { delegate, offerUpdates, getImportCalls: () => importCalls };
}

async function main() {
{
  const { delegate, offerUpdates, getImportCalls } = createHarness();
  const result = await delegate.sync({
    offerId: "offer-1",
    ownerUserId: "user-1",
    attachmentIds: [10, 11],
    sourceRecordKey: "wordpress-db:hb-programs:1",
    sourceId: "src-1",
    sourceHash: "hash",
  });
  assert.equal(result.importedCount, 2);
  assert.equal(getImportCalls(), 2);
  assert.equal(offerUpdates[0]?.coverImage, "/uploads/10.webp");
  assert.deepEqual(offerUpdates[0]?.galleryImages, ["/uploads/11.webp"]);
}

{
  const { delegate, offerUpdates, getImportCalls } = createHarness({ existingIds: [10] });
  const result = await delegate.sync({
    offerId: "offer-1",
    ownerUserId: "user-1",
    attachmentIds: [10, 11],
    sourceRecordKey: "wordpress-db:hb-programs:1",
    sourceId: "src-1",
  });
  assert.equal(result.importedCount, 2);
  assert.equal(getImportCalls(), 1, "existing lineage must not re-download");
  assert.equal(offerUpdates[0]?.coverImage, "/uploads/10.webp");
}

{
  const { delegate, offerUpdates } = createHarness({ missingIds: [99], failIds: [11] });
  const result = await delegate.sync({
    offerId: "offer-1",
    ownerUserId: "user-1",
    attachmentIds: [10, 11, 99],
    sourceRecordKey: "wordpress-db:hb-programs:1",
    sourceId: "src-1",
  });
  assert.equal(result.importedCount, 1);
  assert.ok(result.warnings?.some((w) => w.includes("OFFER_MEDIA_SOURCE_MISSING:99")));
  assert.ok(result.warnings?.some((w) => w.includes("OFFER_MEDIA_IMPORT_FAILED:11")));
  assert.equal(offerUpdates[0]?.coverImage, "/uploads/10.webp");
}

{
  const syncer = new OfferMediaSyncer();
  await assert.rejects(
    () =>
      syncer.sync({
        offerId: "o",
        ownerUserId: "u",
        attachmentIds: [1],
        mediaPolicy: "FULL",
        sourceRecordKey: "k",
      }),
    /deduplicating media delegate/,
  );
  const metadata = await new OfferMediaSyncer({
    sync: async () => ({ importedCount: 0 }),
  }).sync({
    offerId: "o",
    ownerUserId: "u",
    attachmentIds: [1],
    mediaPolicy: "METADATA",
    sourceRecordKey: "k",
  });
  assert.equal(metadata.status, "SKIPPED_POLICY");
}

{
  const { delegate, getImportCalls } = createHarness();
  await delegate.sync({
    offerId: "offer-1",
    ownerUserId: "user-1",
    attachmentIds: [10],
    sourceRecordKey: "wordpress-db:hb-programs:1",
    sourceId: "src-1",
  });
  await delegate.sync({
    offerId: "offer-1",
    ownerUserId: "user-1",
    attachmentIds: [10],
    sourceRecordKey: "wordpress-db:hb-programs:1",
    sourceId: "src-1",
  });
  assert.equal(getImportCalls(), 1, "rerun must reuse MediaAsset lineage");
}

console.log("FullOfferMediaDelegate tests: OK");
}

void main();
