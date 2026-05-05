/**
 * Shared content editor surface — same UI for business dashboard authors and admin/moderation.
 */

import {
  buildAdminPath,
  buildBusinessPath,
  buildSurfaceRedirectDestination,
  normalizeTargetPathForSurface,
  surfaceFromPathname,
} from "../routing/surface";

export type ContentEditorSurface = "business" | "admin";

export type ContentEditorEntity = "place" | "event" | "offer";

/** Serializable nav config (safe to pass from Server Components to client editors). */
export interface ContentEditorNav {
  /** List or queue to open after successful submit (create) or when leaving editor */
  afterSubmitListPath: string;
}

/** Editor URLs — plain strings only (no functions across RSC boundary). */
export function editorPlaceEditHref(placeId: string): string {
  return `/editor/place/${placeId}/edit`;
}

export function editorEventEditHref(eventId: string): string {
  return `/editor/event/${eventId}/edit`;
}

export function editorOfferEditHref(offerId: string): string {
  return `/editor/offer/${offerId}/edit`;
}

/** Default list/queue after submit — depends on surface and entity. */
export function defaultEditorNav(
  surface: ContentEditorSurface,
  entity: ContentEditorEntity
): ContentEditorNav {
  if (surface === "admin") {
    if (entity === "event") {
      return { afterSubmitListPath: buildAdminPath("/content/events") };
    }
    if (entity === "offer") {
      return { afterSubmitListPath: buildAdminPath("/content/offers") };
    }
    return { afterSubmitListPath: buildAdminPath("/content/places") };
  }
  if (entity === "event") {
    return { afterSubmitListPath: buildBusinessPath("/events") };
  }
  if (entity === "offer") {
    return { afterSubmitListPath: buildBusinessPath("/offers") };
  }
  return { afterSubmitListPath: buildBusinessPath("/places") };
}

/** @deprecated Use defaultEditorNav(surface, "place") */
export function defaultNavForSurface(surface: ContentEditorSurface): ContentEditorNav {
  return defaultEditorNav(surface, "place");
}

export function resolveEditorReturnDestination(params: {
  surface: ContentEditorSurface;
  entity: ContentEditorEntity;
  returnTo?: string | null;
  currentHost?: string | null;
  currentProtocol?: string | null;
}): string {
  // If returnTo is provided, use it
  if (params.returnTo?.trim()) {
    const rawTarget = params.returnTo.trim();
    
    // If it's an absolute URL or doesn't start with /, return as-is
    if (
      rawTarget.startsWith("http://") ||
      rawTarget.startsWith("https://") ||
      !rawTarget.startsWith("/")
    ) {
      return rawTarget;
    }
    
    // Build destination based on the path's surface
    const targetSurface = surfaceFromPathname(rawTarget);
    return buildSurfaceRedirectDestination({
      targetSurface,
      targetPath: normalizeTargetPathForSurface(targetSurface, rawTarget),
      currentHost: params.currentHost,
      currentProtocol: params.currentProtocol,
    });
  }
  
  // No returnTo provided - use fallback based on current surface
  // This ensures we stay on the same surface (business → business, admin → admin)
  const fallback = defaultEditorNav(params.surface, params.entity).afterSubmitListPath;
  
  // The fallback already has the correct surface prefix (/admin/... or /business/...)
  // Build the destination to stay on the same surface
  return buildSurfaceRedirectDestination({
    targetSurface: params.surface, // Use current surface, not the one from pathname
    targetPath: normalizeTargetPathForSurface(params.surface, fallback),
    currentHost: params.currentHost,
    currentProtocol: params.currentProtocol,
  });
}
