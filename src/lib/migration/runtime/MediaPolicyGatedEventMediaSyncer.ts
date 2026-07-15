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
 * Either a fixed policy for the whole run (unchanged behavior) or a
 * per-record resolver — used to plug in `resolveSampledMediaPolicy()` so
 * LOCAL/DEV can give FULL to a small allowlisted sample while everything
 * else gets METADATA, without this class needing to know anything about
 * sampling itself.
 */
export type EventMediaPolicyResolver =
  | MediaPolicy
  | ((sourceRecordKey: string) => { policy: MediaPolicy; reason?: string });

/**
 * Gates an `EventMediaSyncer` behind the run's `MediaPolicy` (or a
 * per-record resolver), without touching `EventMediaSyncer` itself:
 * - FULL: delegates straight through — identical to today's behaviour.
 * - METADATA: reports what media evidence was present, but never calls the
 *   inner syncer, so no download/upload/link happens. If the resolver
 *   attached a `reason` (e.g. `SKIPPED_BY_MEDIA_SAMPLE_POLICY`), that's
 *   surfaced as an additional INFO-severity note — never as an error or a
 *   stronger warning than the existing METADATA evidence notes.
 * - NONE: skips entirely, no evidence reported, no inner call.
 */
export class MediaPolicyGatedEventMediaSyncer implements EventMediaSyncerLike {
  constructor(
    private readonly deps: {
      inner: EventMediaSyncerLike;
      mediaPolicy: EventMediaPolicyResolver;
    },
  ) {}

  private resolve(sourceRecordKey: string): { policy: MediaPolicy; reason?: string } {
    return typeof this.deps.mediaPolicy === "function"
      ? this.deps.mediaPolicy(sourceRecordKey)
      : { policy: this.deps.mediaPolicy };
  }

  async sync(
    input: Parameters<EventMediaSyncerLike["sync"]>[0],
  ): Promise<{ warnings: MigrationWarning[] }> {
    const { policy: mediaPolicy, reason } = this.resolve(input.sourceRecordKey);

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

      if (reason) {
        warnings.push(
          warning(
            input.sourceRecordKey,
            reason,
            "Media not imported — this source record is outside the local/dev sample allowlist, not an error.",
          ),
        );
      }

      return { warnings };
    }

    return this.deps.inner.sync(input);
  }
}
