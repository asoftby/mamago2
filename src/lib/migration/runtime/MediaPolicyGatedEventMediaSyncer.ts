import type { EventMediaSyncerLike } from "../commit/event/EventCommitRunner";
import type { MigrationWarning } from "../types";
import type { MediaPolicy } from "./MigrationProfile";

function warning(
  sourceRecordKey: string,
  code: string,
  message: string,
  details?: Record<string, unknown>,
): MigrationWarning {
  return { code, message, severity: "INFO", sourceRecordKey, ...(details ? { details } : {}) };
}

/**
 * Gates an `EventMediaSyncer` behind the run's `MediaPolicy`, without
 * touching `EventMediaSyncer` itself:
 * - FULL: delegates straight through — identical to today's behaviour.
 * - METADATA: reports what media evidence was present, but never calls the
 *   inner syncer, so no download/upload/link happens.
 * - NONE: skips entirely, no evidence reported, no inner call.
 */
export class MediaPolicyGatedEventMediaSyncer implements EventMediaSyncerLike {
  constructor(
    private readonly deps: {
      inner: EventMediaSyncerLike;
      mediaPolicy: MediaPolicy;
    },
  ) {}

  async sync(
    input: Parameters<EventMediaSyncerLike["sync"]>[0],
  ): Promise<{ warnings: MigrationWarning[] }> {
    const { mediaPolicy } = this.deps;

    if (mediaPolicy.name === "NONE") {
      return { warnings: [] };
    }

    if (mediaPolicy.name === "METADATA") {
      const media = input.candidate.media;
      const warnings: MigrationWarning[] = [];

      if (media?.featuredAttachmentId != null) {
        warnings.push(
          warning(
            input.sourceRecordKey,
            "EVENT_MEDIA_POLICY_METADATA_COVER_SKIPPED",
            "Cover attachment evidence found but not imported (media policy METADATA).",
            { attachmentId: media.featuredAttachmentId },
          ),
        );
      }

      if (media?.galleryAttachmentIds.length) {
        warnings.push(
          warning(
            input.sourceRecordKey,
            "EVENT_MEDIA_POLICY_METADATA_GALLERY_SKIPPED",
            "Gallery attachment evidence found but not imported (media policy METADATA).",
            { attachmentIds: media.galleryAttachmentIds },
          ),
        );
      }

      return { warnings };
    }

    return this.deps.inner.sync(input);
  }
}
