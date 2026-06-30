/**
 * Media Registry Helper
 * 
 * Helper functions for integrating media uploads with the MediaAsset registry.
 * Use these functions in upload flows to automatically register media.
 */

import { prisma } from "@/lib/prisma";
import { MediaAssetKind, MediaSourceType, MediaEntityType } from "@prisma/client";
import { createMediaAsset } from "@/server/services/media/media.service";
import { registerMediaUsage, removeMediaUsage } from "@/server/services/media/media-usage.service";
import { getMediaUsageContext } from "./getMediaUsageContext";
import { generateMediaMetadata } from "./generateMediaMetadata";

export interface RegisterMediaInput {
  // File info
  filename: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  width?: number;
  height?: number;
  durationSec?: number;
  
  // Storage
  storageKey: string;
  publicUrl?: string;
  checksum?: string;
  /** SHA-256 of raw original bytes — per-owner dedup key (Phase A). */
  contentHash?: string;

  // Metadata
  alt?: string;
  title?: string;
  caption?: string;
  
  // Source
  sourceType: MediaSourceType;
  /** Required — every MediaAsset must be owned (per-owner dedup invariant). */
  uploadedById: string;
  
  // TEMP media fields
  status?: "TEMP" | "ACTIVE";
  wizardSessionId?: string;
  draftEntityId?: string;
  draftEntityType?: string;
}

export interface AttachMediaInput {
  mediaId: string;
  entityType: MediaEntityType;
  entityId: string;
  field: string;
}

/**
 * Register uploaded media in the registry
 * Returns existing media if storageKey already exists
 */
export async function registerUploadedMedia(input: RegisterMediaInput) {
  // Check if already exists
  const existing = await prisma.mediaAsset.findUnique({
    where: { storageKey: input.storageKey },
  });

  if (existing) {
    return existing;
  }

  // Determine kind from mimeType
  let kind: MediaAssetKind = MediaAssetKind.DOCUMENT;
  if (input.mimeType.startsWith("image/")) {
    kind = MediaAssetKind.IMAGE;
  } else if (input.mimeType.startsWith("video/")) {
    kind = MediaAssetKind.VIDEO;
  }

  const extension = input.filename.split(".").pop() || "";

  // Auto-generate title from originalName if not provided
  let title = input.title;
  if (!title && input.originalName) {
    // Remove extension and clean up filename
    title = input.originalName
      .replace(/\.[^/.]+$/, "") // Remove extension
      .replace(/[-_]/g, " ") // Replace dashes and underscores with spaces
      .replace(/\s+/g, " ") // Normalize multiple spaces
      .trim();
    
    // Capitalize first letter
    if (title) {
      title = title.charAt(0).toUpperCase() + title.slice(1);
    }
  }

  return createMediaAsset({
    kind,
    filename: input.filename,
    originalName: input.originalName,
    mimeType: input.mimeType,
    extension,
    sizeBytes: input.sizeBytes,
    width: input.width,
    height: input.height,
    durationSec: input.durationSec,
    storageKey: input.storageKey,
    publicUrl: input.publicUrl,
    checksum: input.checksum,
    contentHash: input.contentHash,
    alt: input.alt,
    title: title, // Use auto-generated title if not provided
    caption: input.caption,
    sourceType: input.sourceType,
    uploadedById: input.uploadedById,
    status: input.status,
    wizardSessionId: input.wizardSessionId,
    draftEntityId: input.draftEntityId,
    draftEntityType: input.draftEntityType,
  });
}

/**
 * Attach media to entity
 */
export async function attachMediaToEntity(input: AttachMediaInput) {
  return registerMediaUsage(input);
}

/**
 * Detach media from entity
 */
export async function detachMediaFromEntity(
  mediaId: string,
  entityType: MediaEntityType,
  entityId: string,
  field: string
) {
  return removeMediaUsage(mediaId, entityType, entityId, field);
}

/**
 * Register and attach media in one transaction
 * Automatically generates metadata based on usage context
 */
export async function registerAndAttachMedia(
  mediaInput: RegisterMediaInput,
  attachInput: Omit<AttachMediaInput, "mediaId">
) {
  // First register the media without metadata
  const media = await registerUploadedMedia(mediaInput);
  
  // Attach to entity
  await attachMediaToEntity({
    mediaId: media.id,
    ...attachInput,
  });

  // Generate metadata based on usage context if not provided
  if (!mediaInput.title || !mediaInput.alt || !mediaInput.caption) {
    const context = await getMediaUsageContext(media.id);
    
    if (context) {
      const generatedMetadata = generateMediaMetadata(context);
      
      // Update media with generated metadata (only if not already provided)
      await prisma.mediaAsset.update({
        where: { id: media.id },
        data: {
          title: mediaInput.title || generatedMetadata.title,
          alt: mediaInput.alt || generatedMetadata.alt,
          caption: mediaInput.caption || generatedMetadata.caption,
        },
      });
    }
  }

  return media;
}

/**
 * Replace media usage (swap old media for new)
 */
export async function replaceEntityMedia(
  oldMediaStorageKey: string,
  newMediaInput: RegisterMediaInput,
  entityType: MediaEntityType,
  entityId: string,
  field: string
) {
  // Register new media
  const newMedia = await registerUploadedMedia(newMediaInput);

  // Find old media
  const oldMedia = await prisma.mediaAsset.findUnique({
    where: { storageKey: oldMediaStorageKey },
  });

  if (oldMedia) {
    // Remove old usage
    await detachMediaFromEntity(oldMedia.id, entityType, entityId, field);
  }

  // Add new usage
  await attachMediaToEntity({
    mediaId: newMedia.id,
    entityType,
    entityId,
    field,
  });

  return newMedia;
}
