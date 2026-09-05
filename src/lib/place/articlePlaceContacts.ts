import {
  contactsFromPlace,
  type PlaceContactsSource,
  type SharedContactsData,
} from "@/domain/contacts/structuredContacts";

/** Legacy Place writes may contain non-absolute optional URLs. Keep the strict
 * shared contract and omit only malformed optional source fields. */
export function sanitizeOptionalAbsoluteUrl(value: string | null | undefined): string | undefined {
  const candidate = value?.trim();
  if (!candidate) return undefined;
  try {
    const url = new URL(candidate);
    return url.protocol === "http:" || url.protocol === "https:" ? candidate : undefined;
  } catch {
    return undefined;
  }
}

export function contactsFromArticlePlace(source: PlaceContactsSource): SharedContactsData {
  return contactsFromPlace({
    ...source,
    website: sanitizeOptionalAbsoluteUrl(source.website),
    instagramUrl: sanitizeOptionalAbsoluteUrl(source.instagramUrl),
    mapUrl: sanitizeOptionalAbsoluteUrl(source.mapUrl),
  });
}
