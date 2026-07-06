import { buildWordPressAttachmentSourceRecordKey } from "./attachmentSourceRecordKey";
import type {
  LinkPlaceGalleryInput,
  LinkPlaceGalleryResult,
  PlaceMediaLedgerLike,
  PlaceMediaLinkerPrismaClient,
} from "./types";

/**
 * Links already-imported gallery `MediaAsset`s (PR13) to an already-created
 * `Place` (PR9-12) by creating `PlaceImage(kind: "GALLERY")` rows. Nothing
 * here creates a `MediaAsset`, touches `Place.logoImageId`, registers
 * `MediaUsage`, or writes `MigrationRecord`/`MigrationLineage` — this class
 * only reads lineage (via the existing PR6 `MigrationLedgerRepository`)
 * and creates `PlaceImage` rows.
 *
 * `thumbnailAttachmentId` on the input is deliberately never read: logo
 * linking was descoped from this PR (WordPress thumbnails aren't the
 * intended logo source going forward), so this class only ever produces
 * `GALLERY` rows.
 *
 * An attachment with no matching lineage, or lineage pointing at a
 * `mediaId` with no matching `MediaAsset` row, is silently skipped — not
 * an error. `sortOrder` is assigned contiguously (0, 1, 2, ...) in
 * `galleryAttachmentIds` order, counting only the images actually created,
 * so a skipped attachment never leaves a gap.
 */
export class PlaceMediaLinker {
  constructor(
    private readonly deps: {
      ledger: PlaceMediaLedgerLike;
      prisma: PlaceMediaLinkerPrismaClient;
    },
  ) {}

  async linkGalleryImages(input: LinkPlaceGalleryInput): Promise<LinkPlaceGalleryResult> {
    const galleryAttachmentIds = input.media.galleryAttachmentIds;

    if (galleryAttachmentIds.length === 0) {
      return { createdPlaceImageIds: [], skippedAttachmentIds: [] };
    }

    const sourceRecordKeys = galleryAttachmentIds.map((id) => buildWordPressAttachmentSourceRecordKey(id));

    const lineageMap = await this.deps.ledger.findLineageBySourceRecordKeys({
      adapterKey: input.adapterKey,
      sourceNamespace: input.sourceNamespace,
      keys: sourceRecordKeys,
      targetType: "MEDIA_ASSET",
    });

    const mediaIdByAttachmentId = new Map<number, string>();
    const skippedAttachmentIds: number[] = [];

    galleryAttachmentIds.forEach((attachmentId, index) => {
      const lineageRows = lineageMap.get(sourceRecordKeys[index]);
      const mediaId = lineageRows?.[0]?.targetId;
      if (mediaId) {
        mediaIdByAttachmentId.set(attachmentId, mediaId);
      } else {
        skippedAttachmentIds.push(attachmentId);
      }
    });

    const mediaAssets =
      mediaIdByAttachmentId.size === 0
        ? []
        : await this.deps.prisma.mediaAsset.findMany({
            where: { id: { in: [...mediaIdByAttachmentId.values()] } },
          });
    const mediaAssetById = new Map(mediaAssets.map((asset) => [asset.id, asset]));

    const createdPlaceImageIds: string[] = [];
    let sortOrder = 0;

    for (const attachmentId of galleryAttachmentIds) {
      const mediaId = mediaIdByAttachmentId.get(attachmentId);
      if (!mediaId) {
        continue;
      }

      const mediaAsset = mediaAssetById.get(mediaId);
      // `PlaceImage.url` is required and non-nullable — a `MediaAsset`
      // without a `publicUrl` can't produce a valid row, so it's skipped
      // the same as a fully-missing asset rather than writing an empty
      // string (which would be exactly the "broken record" this PR is
      // meant to avoid).
      if (!mediaAsset || !mediaAsset.publicUrl) {
        skippedAttachmentIds.push(attachmentId);
        continue;
      }

      const placeImage = await this.deps.prisma.placeImage.create({
        data: {
          placeId: input.placeId,
          kind: "GALLERY",
          url: mediaAsset.publicUrl,
          width: mediaAsset.width ?? null,
          height: mediaAsset.height ?? null,
          sortOrder,
        },
      });

      createdPlaceImageIds.push(placeImage.id);
      sortOrder += 1;
    }

    return { createdPlaceImageIds, skippedAttachmentIds };
  }
}
