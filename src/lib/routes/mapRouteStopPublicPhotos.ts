/**
 * Public stop gallery URLs for existing `stop.photos[]` UI.
 *
 * `RouteStopImage` is the source of truth when present (includes the first
 * image, matching ActivityImage). Legacy rows with only `photoUrl` still
 * render as a one-item gallery.
 */
export function mapRouteStopPublicPhotos(input: {
  photoUrl?: string | null;
  images?: readonly { url: string | null | undefined; sortOrder?: number }[] | null;
}): string[] {
  const gallery = [...(input.images ?? [])]
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
    .map((row) => row.url?.trim() ?? "")
    .filter(Boolean);

  if (gallery.length > 0) {
    return gallery.filter((url, index, all) => all.indexOf(url) === index);
  }

  const fallback = input.photoUrl?.trim();
  return fallback ? [fallback] : [];
}
