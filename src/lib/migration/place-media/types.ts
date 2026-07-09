import type { PrismaClient } from "@prisma/client";

import type { NormalizedPlaceCandidate } from "../commit/place/types";
import type { FindLineageBySourceRecordKeysInput, LineageMap } from "../ledger/types";

/**
 * The narrowest slice of `MigrationLedgerRepository` this linker needs —
 * one method, reused as-is from PR6. No new lineage-lookup logic here.
 */
export interface PlaceMediaLedgerLike {
  findLineageBySourceRecordKeys(input: FindLineageBySourceRecordKeysInput): Promise<LineageMap>;
}

/**
 * `mediaAsset.findMany` (to resolve `publicUrl`/`width`/`height` for the
 * media IDs lineage points at) and `placeImage.create` only. No
 * `place.update` — this PR never touches `Place.logoImageId` (logo is out
 * of scope, see PR14 correction). No `mediaAsset.create` — media is never
 * (re-)created here, only read.
 */
export interface PlaceMediaLinkerPrismaClient {
  mediaAsset: Pick<PrismaClient["mediaAsset"], "findMany">;
  placeImage: Pick<PrismaClient["placeImage"], "create">;
}

export interface LinkPlaceGalleryInput {
  adapterKey: string;
  sourceNamespace: string;
  /**
   * Currently unused by the lookup itself — `findLineageBySourceRecordKeys`
   * resolves the `MigrationSource` row from `adapterKey`/`sourceNamespace`,
   * not `sourceId` directly. Kept on the input for shape-parity with the
   * originally agreed PR14 contract; not read anywhere in this class.
   */
  sourceId: string;
  placeId: string;
  /**
   * The full normalized media shape, including `thumbnailAttachmentId` —
   * deliberately ignored. Logo linking is out of scope for this PR (WP
   * thumbnails aren't used for `Place` logos; a later PR sources logos
   * from Instagram instead). Only `galleryAttachmentIds` is read.
   */
  media: NormalizedPlaceCandidate["media"];
}

export interface LinkPlaceGalleryResult {
  createdPlaceImageIds: readonly string[];
  skippedAttachmentIds: readonly number[];
}
