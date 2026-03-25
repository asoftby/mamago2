/**
 * Shared content editor surface — same UI for business dashboard authors and admin/moderation.
 */

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
      return { afterSubmitListPath: "/admin/moderation/events" };
    }
    if (entity === "offer") {
      return { afterSubmitListPath: "/admin/moderation/offers" };
    }
    return { afterSubmitListPath: "/admin/moderation/places" };
  }
  if (entity === "event") {
    return { afterSubmitListPath: "/business/events" };
  }
  if (entity === "offer") {
    return { afterSubmitListPath: "/business/offers" };
  }
  return { afterSubmitListPath: "/business/places" };
}

/** @deprecated Use defaultEditorNav(surface, "place") */
export function defaultNavForSurface(surface: ContentEditorSurface): ContentEditorNav {
  return defaultEditorNav(surface, "place");
}
