import type { PlaceMediaSyncerLike } from "../commit/place/PlaceCommitRunner";
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

const ZERO_COUNTS = { imported: 0, reused: 0, skipped: 0, failed: 0 } as const;

/**
 * Either a fixed policy for the whole run, or a per-record resolver — the
 * same shape as `EventMediaPolicyResolver`, reused here so
 * `resolveSampledMediaPolicy()` (which already has a Place allowlist, see
 * `sampledMediaPolicy.ts`) plugs in identically.
 */
export type PlaceMediaPolicyResolver =
  | MediaPolicy
  | ((sourceRecordKey: string) => { policy: MediaPolicy; reason?: string });

/**
 * Gates a `PlaceMediaSyncer` behind the run's `MediaPolicy` (or a
 * per-record resolver), without touching `PlaceMediaSyncer` itself:
 * - FULL: delegates straight through — real download/import/link.
 * - METADATA: reports what cover/gallery attachment evidence was present,
 *   but never calls the inner syncer, so no download/upload/link happens.
 *   If the resolver attached a `reason` (e.g. `SKIPPED_BY_MEDIA_SAMPLE_POLICY`),
 *   that's surfaced as an additional INFO-severity note.
 * - NONE: skips entirely, no evidence reported, no inner call.
 */
export class MediaPolicyGatedPlaceMediaSyncer implements PlaceMediaSyncerLike {
  constructor(
    private readonly deps: {
      inner: PlaceMediaSyncerLike;
      mediaPolicy: PlaceMediaPolicyResolver;
    },
  ) {}

  private resolve(sourceRecordKey: string): { policy: MediaPolicy; reason?: string } {
    return typeof this.deps.mediaPolicy === "function"
      ? this.deps.mediaPolicy(sourceRecordKey)
      : { policy: this.deps.mediaPolicy };
  }

  async sync(input: Parameters<PlaceMediaSyncerLike["sync"]>[0]): ReturnType<PlaceMediaSyncerLike["sync"]> {
    const { policy: mediaPolicy, reason } = this.resolve(input.sourceRecordKey);

    if (mediaPolicy.name === "NONE") {
      return { warnings: [], ...ZERO_COUNTS };
    }

    if (mediaPolicy.name === "METADATA") {
      const media = input.candidate.media;
      const warnings: MigrationWarning[] = [];

      if (media.thumbnailAttachmentId !== null) {
        warnings.push(
          warning(
            input.sourceRecordKey,
            "PLACE_MEDIA_POLICY_METADATA_COVER_SKIPPED",
            "Cover attachment evidence found but not imported (media policy METADATA).",
            { attachmentId: media.thumbnailAttachmentId },
          ),
        );
      }

      if (media.galleryAttachmentIds.length > 0) {
        warnings.push(
          warning(
            input.sourceRecordKey,
            "PLACE_MEDIA_POLICY_METADATA_GALLERY_SKIPPED",
            "Gallery attachment evidence found but not imported (media policy METADATA).",
            { attachmentIds: media.galleryAttachmentIds },
          ),
        );
      }

      if (reason) {
        warnings.push(warning(input.sourceRecordKey, "PLACE_MEDIA_SAMPLE_SKIPPED", "Media not imported — this source record is outside the local/dev sample allowlist, not an error."));
      }

      return { warnings, ...ZERO_COUNTS };
    }

    return this.deps.inner.sync(input);
  }
}
