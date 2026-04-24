import { inferSocialNetworkFromUrl, parseContentImportContactsHint } from "@/lib/content-editor/importContactsHint";

export type ContentImportOrganizerHint = {
  name: string | null;
  phone: string | null;
  website: string | null;
  instagram: string | null;
};

function pickOrganizerName(raw: Record<string, unknown>): string | null {
  const candidates = [
    raw.organizerName,
    raw.organizer,
    raw.host,
    raw.hostName,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim().length > 0) {
      return candidate.trim();
    }
  }

  return null;
}

function pickInstagramUrl(urls: string[]): string | null {
  const instagram = urls.find((url) => inferSocialNetworkFromUrl(url) === "instagram");
  return instagram?.trim() ?? null;
}

export function parseContentImportOrganizerHint(raw: unknown): ContentImportOrganizerHint | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return null;
  }

  const normalized = raw as Record<string, unknown>;
  const name = pickOrganizerName(normalized);
  const contacts = parseContentImportContactsHint(raw);
  const instagram =
    typeof normalized.instagram === "string" && normalized.instagram.trim().length > 0
      ? normalized.instagram.trim()
      : pickInstagramUrl(contacts?.socialUrls ?? []);

  if (!name && !contacts?.phone && !contacts?.website && !instagram) {
    return null;
  }

  return {
    name,
    phone: contacts?.phone ?? null,
    website: contacts?.website ?? null,
    instagram,
  };
}
