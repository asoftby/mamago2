import type { MediaAsset, MediaUrlAlias } from "@prisma/client";
import { extractMediaRelativePathFromUrl } from "@/lib/media/mediaUrlBuilder";
import { normalizeMediaStorageRelativePath } from "@/server/media/media-storage";

export type MediaAliasWithAsset = MediaUrlAlias & { media: MediaAsset };

export function normalizeMediaAliasPath(input: string): string | null {
  const clean = input.trim().split(/[?#]/)[0] ?? "";
  const uploadsMarker = "/uploads/";
  const uploadsIndex = clean.indexOf(uploadsMarker);
  const raw = extractMediaRelativePathFromUrl(input) ??
    (uploadsIndex >= 0 ? clean.slice(uploadsIndex + uploadsMarker.length) : clean);
  const relative = raw.split("/").map((segment) => {
    try { return decodeURIComponent(segment); } catch { return ""; }
  }).join("/");
  return normalizeMediaStorageRelativePath(relative);
}

/**
 * Canonical redirect target for a legacy alias.
 * Always a same-origin relative media path (`/api/media/file/...`).
 * External / non-media publicUrl values are refused (no open redirect).
 */
export function canonicalAliasDestination(alias: MediaAliasWithAsset): string | null {
  const current = alias.media.publicUrl?.trim();
  if (!current) return null;
  const currentPath = normalizeMediaAliasPath(current);
  if (!currentPath || currentPath === alias.legacyPath) return null;
  // Rebuild from the normalized storage-relative path so a stale absolute or
  // host-qualified publicUrl can never escape into Location.
  return `/api/media/file/${currentPath}`;
}

export function decideMediaAliasRedirect(input: {
  alias: MediaAliasWithAsset;
  canServe: boolean;
  canonicalFileExists: boolean;
}): { status: 308; destination: string } | { status: 404 } {
  const destination = canonicalAliasDestination(input.alias);
  if (!destination || !input.canServe || !input.canonicalFileExists) return { status: 404 };
  return { status: 308, destination };
}

/** Relative 308 — never absolute (avoids request.url / 0.0.0.0:3000 bind origin). */
export function mediaAliasRedirectResponse(destination: string): Response {
  if (!destination.startsWith("/api/media/file/") || destination.includes("://") || destination.includes("\\")) {
    throw new Error(`Refusing non-relative media alias destination: ${destination}`);
  }
  return new Response(null, {
    status: 308,
    headers: {
      Location: destination,
    },
  });
}
