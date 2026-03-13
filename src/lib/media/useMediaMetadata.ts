/**
 * Use Media Metadata
 * 
 * Helper for components that display images.
 * Returns effective metadata with auto-generation fallback.
 */

import { MediaEntityType } from "@prisma/client";
import { generateMediaMetadata, MediaMetadataContext } from "./generateMediaMetadata";

/**
 * Get effective alt text for an image
 * Priority: manual > auto-generated > fallback
 */
export function getEffectiveAlt(
  manualAlt: string | null | undefined,
  context?: {
    entityType: MediaEntityType;
    entityTitle?: string | null;
    field?: string | null;
  },
  fallback?: string
): string {
  // 1. Manual value
  if (manualAlt) {
    return manualAlt;
  }

  // 2. Auto-generated from context
  if (context?.entityTitle) {
    const generated = generateMediaMetadata(context);
    if (generated.alt) {
      return generated.alt;
    }
  }

  // 3. Fallback
  return fallback || "";
}

/**
 * Get effective title for an image
 */
export function getEffectiveTitle(
  manualTitle: string | null | undefined,
  context?: MediaMetadataContext,
  fallback?: string
): string | undefined {
  if (manualTitle) {
    return manualTitle;
  }

  if (context?.entityTitle) {
    const generated = generateMediaMetadata(context);
    if (generated.title) {
      return generated.title;
    }
  }

  return fallback;
}
