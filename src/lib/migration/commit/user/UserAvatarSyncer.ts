import type { PrismaClient } from "@prisma/client";

import type { MigrationWarning } from "../../types";
import { buildWordPressAttachmentSourceRecordKey } from "../../place-media/attachmentSourceRecordKey";
import { MediaImportWriter } from "../../media/MediaImportWriter";
import type { MediaImporterLike, MediaLineageWriterLike } from "../../media/types";
import type { VoxelAvatarSourceClassification } from "./voxelAvatarSource";

export interface UserAvatarSyncerPrismaClient {
  user: Pick<PrismaClient["user"], "updateMany" | "findUnique">;
  mediaAsset: Pick<PrismaClient["mediaAsset"], "findFirst">;
  migrationLineage: Pick<PrismaClient["migrationLineage"], "findFirst">;
}

export interface UserAvatarSyncInput {
  /** The already-migrated target User's id. Never created or recreated here. */
  userId: string;
  /** The user's own `wordpress-db:user:{id}` key — attached to warnings only, never used as a lineage key here (the attachment-level lineage key is entity-agnostic, see `buildWordPressAttachmentSourceRecordKey`). */
  sourceRecordKey: string;
  avatarSource: VoxelAvatarSourceClassification;
  sourceId: string;
  sourceHash: string;
  runId?: string | null;
  recordId?: string | null;
}

export type UserAvatarSyncOutcome =
  | "AVATAR_IMPORTED"
  | "AVATAR_MEDIA_REUSED"
  | "AVATAR_ALREADY_UP_TO_DATE"
  | "AVATAR_SKIPPED_NO_SOURCE"
  | "AVATAR_SKIPPED_NON_ATTACHMENT_VALUE"
  | "AVATAR_SKIPPED_ATTACHMENT_MISSING"
  | "AVATAR_SKIPPED_UNSUPPORTED_FORMAT"
  | "AVATAR_SKIPPED_SOURCE_URL_INVALID"
  | "AVATAR_SKIPPED_EXISTING_VALUE"
  | "AVATAR_IMPORT_FAILED";

export interface UserAvatarSyncResult {
  outcome: UserAvatarSyncOutcome;
  avatarUrl: string | null;
  mediaId: string | null;
  warnings: MigrationWarning[];
}

function warning(
  sourceRecordKey: string,
  code: string,
  message: string,
  details?: Record<string, unknown>,
  severity: MigrationWarning["severity"] = "WARNING",
): MigrationWarning {
  return { code, message, severity, sourceRecordKey, ...(details ? { details } : {}) };
}

function isUsableHttpUrl(value: string | null | undefined): boolean {
  if (!value?.trim()) return false;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function isHeicMime(mime: string): boolean {
  const lower = mime.toLowerCase();
  return lower === "image/heic" || lower === "image/heif";
}

function classifyImportError(message: string): "AVATAR_DOWNLOAD_FAILED" | "AVATAR_PROCESS_FAILED" {
  if (/failed to download|exceeds the maximum allowed size|http \d+/i.test(message)) {
    return "AVATAR_DOWNLOAD_FAILED";
  }
  return "AVATAR_PROCESS_FAILED";
}

/**
 * Imports (or reuses) exactly one WordPress-Voxel custom avatar attachment
 * and writes it to `User.avatarUrl` — the narrowest possible mutation, not
 * a general User replay:
 *
 * - Never creates or looks up a User by email/source key; `userId` must
 *   already be a real, migrated User (the caller resolves this via the
 *   existing primary `MigrationLineage` row before calling `sync()`).
 * - Never touches any other `User` column. The write is a single
 *   `updateMany({ where: { id, avatarUrl: null }, data: { avatarUrl } })` —
 *   SQL-atomic, and a no-op unless `avatarUrl` is currently `null`, so an
 *   already-set avatar (whether from this importer's own earlier run or
 *   from the user uploading their own photo in the app) is never
 *   overwritten.
 * - Media import/reuse mirrors `PlaceMediaSyncer.importOrReuseAttachment`:
 *   `buildWordPressAttachmentSourceRecordKey(attachmentId)` is an
 *   entity-agnostic lineage key, so if this exact attachment was already
 *   imported for anything else (or by an earlier avatar run), the existing
 *   `MediaAsset` is reused and zero bytes are downloaded — the same
 *   dedup-by-lineage the rest of the migration pipeline relies on instead
 *   of `MediaAsset.contentHash` (never populated by this pipeline).
 * - `uploadedById` on the created `MediaAsset` is always the target User
 *   itself (`mediaImporterFactory(input.userId)`), per task requirement —
 *   never a migration/system account.
 */
export class UserAvatarSyncer {
  constructor(
    private readonly deps: {
      prisma: UserAvatarSyncerPrismaClient;
      mediaImporterFactory: (uploadedByUserId: string) => MediaImporterLike;
      lineageWriter: MediaLineageWriterLike;
    },
  ) {}

  async sync(input: UserAvatarSyncInput): Promise<UserAvatarSyncResult> {
    const { avatarSource, sourceRecordKey } = input;

    if (avatarSource.status === "NO_AVATAR_SOURCE") {
      return { outcome: "AVATAR_SKIPPED_NO_SOURCE", avatarUrl: null, mediaId: null, warnings: [] };
    }
    if (avatarSource.status === "AVATAR_NON_ATTACHMENT_VALUE") {
      return {
        outcome: "AVATAR_SKIPPED_NON_ATTACHMENT_VALUE",
        avatarUrl: null,
        mediaId: null,
        warnings: [
          warning(
            sourceRecordKey,
            "AVATAR_NON_ATTACHMENT_VALUE",
            "voxel:avatar meta_value is not a WordPress attachment id (Telegram/Gravatar/default-style value); skipped without attempting an import.",
            { rawValue: avatarSource.rawValue },
            "INFO",
          ),
        ],
      };
    }
    if (avatarSource.status === "AVATAR_ATTACHMENT_MISSING") {
      return {
        outcome: "AVATAR_SKIPPED_ATTACHMENT_MISSING",
        avatarUrl: null,
        mediaId: null,
        warnings: [
          warning(
            sourceRecordKey,
            "AVATAR_ATTACHMENT_MISSING",
            "voxel:avatar references a WordPress attachment id whose wp_posts row no longer exists (broken ref); explained skip, not a failure.",
            { attachmentId: avatarSource.attachmentId },
          ),
        ],
      };
    }

    const { attachment, attachmentId } = avatarSource;

    if (isHeicMime(attachment.post_mime_type) || !attachment.post_mime_type?.toLowerCase().startsWith("image/")) {
      return {
        outcome: "AVATAR_SKIPPED_UNSUPPORTED_FORMAT",
        avatarUrl: null,
        mediaId: null,
        warnings: [
          warning(sourceRecordKey, "AVATAR_FORMAT_UNSUPPORTED", "Avatar attachment mime type is not a supported image format; skipped without attempting a download.", {
            attachmentId,
            mimeType: attachment.post_mime_type,
          }),
        ],
      };
    }
    if (!isUsableHttpUrl(attachment.guid)) {
      return {
        outcome: "AVATAR_SKIPPED_SOURCE_URL_INVALID",
        avatarUrl: null,
        mediaId: null,
        warnings: [
          warning(sourceRecordKey, "AVATAR_SOURCE_MISSING", "WordPress avatar attachment guid is not a valid http(s) URL.", {
            attachmentId,
            guid: attachment.guid,
          }),
        ],
      };
    }

    const warnings: MigrationWarning[] = [];
    const resolved = await this.resolveOrImportAttachment({
      attachmentId,
      attachment,
      uploadedByUserId: input.userId,
      sourceId: input.sourceId,
      sourceHash: input.sourceHash || sourceRecordKey,
      runId: input.runId ?? null,
      recordId: input.recordId ?? null,
      sourceRecordKey,
      warnings,
    });
    if (!resolved) {
      return { outcome: "AVATAR_IMPORT_FAILED", avatarUrl: null, mediaId: null, warnings };
    }

    const written = await this.deps.prisma.user.updateMany({
      where: { id: input.userId, avatarUrl: null },
      data: { avatarUrl: resolved.publicUrl },
    });

    if (written.count === 1) {
      warnings.push(
        warning(
          sourceRecordKey,
          resolved.reusedMedia ? "AVATAR_SET_FROM_REUSED_MEDIA" : "AVATAR_SET",
          "User.avatarUrl was set from the migrated Voxel avatar attachment.",
          { attachmentId, mediaId: resolved.mediaId },
          "INFO",
        ),
      );
      return {
        outcome: resolved.reusedMedia ? "AVATAR_MEDIA_REUSED" : "AVATAR_IMPORTED",
        avatarUrl: resolved.publicUrl,
        mediaId: resolved.mediaId,
        warnings,
      };
    }

    // updateMany matched zero rows: avatarUrl is already non-null. Either
    // this is a rerun of this exact import (idempotent — nothing to do), or
    // the User already has a different avatar (this importer's own earlier
    // write, or the user's own upload) which must never be overwritten.
    const current = await this.deps.prisma.user.findUnique({ where: { id: input.userId }, select: { avatarUrl: true } });
    if (current?.avatarUrl === resolved.publicUrl) {
      warnings.push(
        warning(sourceRecordKey, "AVATAR_ALREADY_UP_TO_DATE", "User.avatarUrl already matches the migrated attachment; rerun made no change.", {
          attachmentId,
          mediaId: resolved.mediaId,
        }, "INFO"),
      );
      return { outcome: "AVATAR_ALREADY_UP_TO_DATE", avatarUrl: resolved.publicUrl, mediaId: resolved.mediaId, warnings };
    }

    warnings.push(
      warning(
        sourceRecordKey,
        "AVATAR_EXISTING_VALUE_PROTECTED",
        "User.avatarUrl is already set to a different value; migration never overwrites an existing avatar.",
        { attachmentId, mediaId: resolved.mediaId, currentAvatarUrl: current?.avatarUrl ?? null },
      ),
    );
    return { outcome: "AVATAR_SKIPPED_EXISTING_VALUE", avatarUrl: current?.avatarUrl ?? null, mediaId: resolved.mediaId, warnings };
  }

  private async resolveOrImportAttachment(input: {
    attachmentId: number;
    attachment: NonNullable<Extract<VoxelAvatarSourceClassification, { status: "AVATAR_ATTACHMENT_VALID" }>["attachment"]>;
    uploadedByUserId: string;
    sourceId: string;
    sourceHash: string;
    runId: string | null;
    recordId: string | null;
    sourceRecordKey: string;
    warnings: MigrationWarning[];
  }): Promise<{ mediaId: string; publicUrl: string; reusedMedia: boolean } | null> {
    const attachmentSourceRecordKey = buildWordPressAttachmentSourceRecordKey(input.attachmentId);
    const existingLineage = await this.deps.prisma.migrationLineage.findFirst({
      where: { sourceId: input.sourceId, sourceRecordKey: attachmentSourceRecordKey, targetType: "MEDIA_ASSET", isActive: true },
      select: { targetId: true },
    });
    if (existingLineage?.targetId) {
      const asset = await this.deps.prisma.mediaAsset.findFirst({
        where: { id: existingLineage.targetId, deletedAt: null },
        select: { id: true, publicUrl: true },
      });
      if (asset?.publicUrl?.trim()) {
        input.warnings.push(
          warning(
            input.sourceRecordKey,
            "AVATAR_MEDIA_ASSET_REUSED",
            "Existing imported MediaAsset lineage was reused for this avatar attachment; no download attempted.",
            { attachmentId: input.attachmentId, mediaAssetId: asset.id },
            "INFO",
          ),
        );
        return { mediaId: asset.id, publicUrl: asset.publicUrl.trim(), reusedMedia: true };
      }
    }

    try {
      const importer = this.deps.mediaImporterFactory(input.uploadedByUserId);
      const writer = new MediaImportWriter({ mediaImporter: importer, lineageWriter: this.deps.lineageWriter });
      const result = await writer.importWordPressAttachment({
        attachment: input.attachment,
        sourceId: input.sourceId,
        sourceRecordKey: attachmentSourceRecordKey,
        sourceEntityType: "wordpress-db:attachment",
        sourceStableKey: `attachment:${input.attachmentId}`,
        sourceHash: input.sourceHash,
        targetRole: "user-avatar",
        runId: input.runId,
        recordId: input.recordId,
      });
      input.warnings.push(
        warning(
          input.sourceRecordKey,
          "AVATAR_MEDIA_IMPORTED",
          "Avatar attachment was downloaded and imported as a new MediaAsset.",
          { attachmentId: input.attachmentId, mediaAssetId: result.mediaId },
          "INFO",
        ),
      );
      return { mediaId: result.mediaId, publicUrl: result.publicUrl, reusedMedia: false };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const code = classifyImportError(message);
      input.warnings.push(
        warning(input.sourceRecordKey, code, "Avatar media import failed.", { attachmentId: input.attachmentId, error: message }),
      );
      return null;
    }
  }
}
