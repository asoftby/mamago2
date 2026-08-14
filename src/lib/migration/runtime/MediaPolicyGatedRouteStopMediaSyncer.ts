import type { RouteStopMediaSyncerLike } from "../commit/route/RouteCommitRunner";
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
 * Gates RouteStop media sync behind the run's `MediaPolicy`.
 * FULL delegates to the real syncer; METADATA reports source evidence
 * without downloading/linking; NONE fully skips.
 */
export class MediaPolicyGatedRouteStopMediaSyncer implements RouteStopMediaSyncerLike {
  constructor(
    private readonly deps: {
      inner: RouteStopMediaSyncerLike;
      mediaPolicy: MediaPolicy;
    },
  ) {}

  async sync(
    input: Parameters<RouteStopMediaSyncerLike["sync"]>[0],
  ): Promise<{ warnings: MigrationWarning[] }> {
    const { mediaPolicy } = this.deps;

    if (mediaPolicy.name === "NONE") {
      return { warnings: [] };
    }

    if (mediaPolicy.name === "METADATA") {
      const featuredAttachmentId = input.candidate.media.featuredAttachmentId;
      const stopsWithMedia = input.candidate.stops
        .filter((stop) => stop.imageAttachmentIds.length > 0)
        .map((stop) => ({
          sourceStopIndex: stop.index,
          attachmentIds: stop.imageAttachmentIds,
        }));

      if (featuredAttachmentId === null && stopsWithMedia.length === 0) {
        return { warnings: [] };
      }

      return {
        warnings: [
          warning(
            input.sourceRecordKey,
            "ROUTE_STOP_MEDIA_POLICY_METADATA_SKIPPED",
            "Route image attachment evidence found but not imported (media policy METADATA).",
            { featuredAttachmentId, stops: stopsWithMedia },
          ),
        ],
      };
    }

    return this.deps.inner.sync(input);
  }
}
