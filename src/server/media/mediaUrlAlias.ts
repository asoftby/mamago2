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

export function canonicalAliasDestination(alias: MediaAliasWithAsset): string | null {
  const current = alias.media.publicUrl?.trim();
  const currentPath = current ? normalizeMediaAliasPath(current) : null;
  if (!current || !currentPath || currentPath === alias.legacyPath) return null;
  return current;
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
