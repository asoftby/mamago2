export function uniquePublicationMedia(values: readonly (string | null | undefined)[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const normalized = value?.trim();
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    result.push(normalized);
  }
  return result;
}

export function mergePrimaryWithGallery(
  primary: string | null | undefined,
  gallery: readonly string[],
): string[] {
  return uniquePublicationMedia([primary, ...gallery]);
}

export function splitPrimaryFromGallery(values: readonly string[]): {
  primary: string | null;
  gallery: string[];
} {
  const media = uniquePublicationMedia(values);
  return {
    primary: media[0] ?? null,
    gallery: media.slice(1),
  };
}
