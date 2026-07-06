import type {
  ImportWordPressAttachmentInput,
  ImportWordPressAttachmentResult,
  MediaImporterLike,
  MediaLineageWriterLike,
} from "./types";

const DEFAULT_TARGET_ROLE = "primary";

function assertInputIsUsable(input: ImportWordPressAttachmentInput): void {
  if (!input.sourceId?.trim()) {
    throw new Error("ImportWordPressAttachmentInput.sourceId is required.");
  }
  if (!input.sourceRecordKey?.trim()) {
    throw new Error("ImportWordPressAttachmentInput.sourceRecordKey is required.");
  }
  if (!input.sourceEntityType?.trim()) {
    throw new Error("ImportWordPressAttachmentInput.sourceEntityType is required.");
  }
  if (!input.sourceStableKey?.trim()) {
    throw new Error("ImportWordPressAttachmentInput.sourceStableKey is required.");
  }
  if (!input.sourceHash?.trim()) {
    throw new Error("ImportWordPressAttachmentInput.sourceHash is required.");
  }
  if (!input.attachment?.guid?.trim()) {
    throw new Error("ImportWordPressAttachmentInput.attachment.guid is required.");
  }
}

/**
 * Imports one WordPress attachment as a standalone `MediaAsset` and
 * records its `MigrationLineage`. Nothing here knows how the file is
 * actually downloaded/processed/stored — that's `MediaImporterLike`'s job
 * (the real implementation, `createMamagoMediaImporter`, wraps mamaGo's
 * existing upload pipeline). This class only sequences two calls and
 * shapes the lineage record; it never touches `Place`, `PlaceImage`,
 * `Article`, or `MigrationRecord`.
 *
 * `targetStableKey` is set to the resulting `storageKey` rather than
 * `mediaId` or `publicUrl`: `targetId` already carries `mediaId`, so
 * repeating it as the natural key would be redundant, and `publicUrl` can
 * change independently of the file itself (CDN moves, storage backend
 * changes) — `storageKey` is the real, unique natural key of the stored
 * file and survives those changes.
 *
 * Errors from either dependency propagate raw — this is an infrastructure
 * failure, not a business-level outcome to convert into a typed result.
 */
export class MediaImportWriter {
  constructor(
    private readonly deps: {
      mediaImporter: MediaImporterLike;
      lineageWriter: MediaLineageWriterLike;
    },
  ) {}

  async importWordPressAttachment(
    input: ImportWordPressAttachmentInput,
  ): Promise<ImportWordPressAttachmentResult> {
    assertInputIsUsable(input);

    const imported = await this.deps.mediaImporter.importFromUrl({
      sourceUrl: input.attachment.guid,
      filenameHint: input.attachment.post_name || null,
      title: input.attachment.post_title || null,
      sourceRecordKey: input.sourceRecordKey,
    });

    const lineage = await this.deps.lineageWriter.createLineage({
      sourceId: input.sourceId,
      sourceEntityType: input.sourceEntityType,
      sourceStableKey: input.sourceStableKey,
      sourceRecordKey: input.sourceRecordKey,
      targetType: "MEDIA_ASSET",
      targetRole: DEFAULT_TARGET_ROLE,
      targetId: imported.mediaId,
      targetStableKey: imported.storageKey,
      lastSourceHash: input.sourceHash,
      runId: input.runId ?? null,
      recordId: input.recordId ?? null,
    });

    return {
      mediaId: imported.mediaId,
      lineageId: lineage.lineageId,
      publicUrl: imported.publicUrl,
    };
  }
}
