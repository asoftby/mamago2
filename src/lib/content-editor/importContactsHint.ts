/**
 * Контакты из нормализованного импорта → prefill редактора (без автосохранения).
 */

import { normalizePhoneToE164 } from "@/lib/phone/e164";
import type { EventFormData, SocialLink } from "@/components/business/wizard/event/types";
import type { PlaceFormData } from "@/components/business/wizard/place/types";

export type ContentImportContactsHint = {
  phone: string | null;
  website: string | null;
  socialUrls: string[];
};

function extractSocialUrlsFromNormalized(o: Record<string, unknown>): string[] {
  const direct = o.socialUrls;
  if (Array.isArray(direct)) {
    return direct
      .filter((u): u is string => typeof u === "string" && u.trim().length > 0)
      .map((u) => u.trim());
  }
  const links = o.socialLinks;
  if (!Array.isArray(links)) return [];
  const out: string[] = [];
  for (const item of links) {
    if (typeof item === "string" && item.trim()) {
      out.push(item.trim());
      continue;
    }
    if (item && typeof item === "object" && "url" in item) {
      const u = (item as { url?: unknown }).url;
      if (typeof u === "string" && u.trim()) out.push(u.trim());
    }
  }
  return out;
}

/** Определение сети по URL (как в шаге контактов события). */
export function inferSocialNetworkFromUrl(url: string): SocialLink["network"] {
  let host = "";
  try {
    host = new URL(url.trim()).hostname.toLowerCase();
  } catch {
    const u = url.toLowerCase();
    if (u.includes("instagram.com")) return "instagram";
    if (u.includes("t.me") || u.includes("telegram.")) return "telegram";
    if (u.includes("tiktok.com")) return "tiktok";
    if (u.includes("youtube.com") || u.includes("youtu.be")) return "youtube";
    return "other";
  }
  if (host.includes("instagram")) return "instagram";
  if (host === "t.me" || host.endsWith(".t.me") || host.includes("telegram")) return "telegram";
  if (host.includes("tiktok")) return "tiktok";
  if (host.includes("youtube") || host === "youtu.be") return "youtube";
  return "other";
}

function normalizeWebsiteUrl(raw: string): string {
  const t = raw.trim();
  if (!t) return t;
  if (/^https?:\/\//i.test(t)) return t;
  return `https://${t}`;
}

export function parseContentImportContactsHint(raw: unknown): ContentImportContactsHint | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const entity = o.entityType;
  if (entity !== "EVENT" && entity !== "PLACE") return null;

  let phone: string | null = null;
  let website: string | null = null;
  const socialUrls: string[] = [];

  if (entity === "EVENT") {
    const p =
      typeof o.phone === "string" && o.phone.trim()
        ? o.phone.trim()
        : Array.isArray(o.phones) && typeof o.phones[0] === "string"
          ? o.phones[0].trim()
          : null;
    phone = p || null;

    const w =
      typeof o.website === "string" && o.website.trim()
        ? o.website.trim()
        : Array.isArray(o.websites) && typeof o.websites[0] === "string"
          ? o.websites[0].trim()
          : null;
    website = w ? normalizeWebsiteUrl(w) : null;

    socialUrls.push(...extractSocialUrlsFromNormalized(o));
  } else {
    const phones = Array.isArray(o.phones) ? o.phones : [];
    const firstPhone = phones.find((x): x is string => typeof x === "string" && x.trim().length > 0);
    phone = firstPhone?.trim() ?? null;

    const websites = Array.isArray(o.websites) ? o.websites : [];
    const firstSite = websites.find((x): x is string => typeof x === "string" && x.trim().length > 0);
    website = firstSite ? normalizeWebsiteUrl(firstSite.trim()) : null;

    socialUrls.push(...extractSocialUrlsFromNormalized(o));
  }

  const uniqSocial = [...new Set(socialUrls)];

  if (!phone && !website && uniqSocial.length === 0) return null;

  return {
    phone,
    website,
    socialUrls: uniqSocial,
  };
}

/** Prefill только в пустые поля; не перезаписывает данные из БД / пользователя. */
export function mergeEventImportContactsPrefill(
  data: EventFormData,
  hint: ContentImportContactsHint | null | undefined,
): EventFormData {
  if (!hint) return data;

  const nextPhone =
    !data.phone?.trim() && hint.phone?.trim() ? normalizePhoneToE164(hint.phone) : data.phone;

  const nextWebsite =
    !data.website?.trim() && hint.website?.trim() ? hint.website.trim() : data.website;

  const hasFilledSocial = data.socialLinks.some((l) => l.url.trim().length > 0);
  let nextSocial = data.socialLinks;
  if (!hasFilledSocial && hint.socialUrls.length > 0) {
    nextSocial = hint.socialUrls.map((url, i) => ({
      id: `import-social-${i}-${url.slice(0, 24)}`,
      network: inferSocialNetworkFromUrl(url),
      url: url.trim(),
    }));
  }

  if (
    nextPhone === data.phone &&
    nextWebsite === data.website &&
    nextSocial === data.socialLinks
  ) {
    return data;
  }

  return { ...data, phone: nextPhone, website: nextWebsite, socialLinks: nextSocial };
}

function extractInstagramHandleFromUrl(url: string): string | null {
  try {
    const u = new URL(url.trim());
    const host = u.hostname.toLowerCase();
    if (!host.includes("instagram.com")) return null;
    const seg = u.pathname.split("/").filter(Boolean)[0];
    if (!seg || seg === "p" || seg === "reel" || seg === "stories") return null;
    return seg.replace(/^@/, "");
  } catch {
    return null;
  }
}

export function mergePlaceImportContactsPrefill(
  data: PlaceFormData,
  hint: ContentImportContactsHint | null | undefined,
): PlaceFormData {
  if (!hint) return data;

  const nextPhone =
    (!data.phone || !String(data.phone).trim()) && hint.phone?.trim()
      ? normalizePhoneToE164(hint.phone)
      : data.phone;

  const nextWebsite =
    (!data.website || !String(data.website).trim()) && hint.website?.trim()
      ? hint.website.trim()
      : data.website;

  const noIg =
    !(data.instagramHandle?.trim() ?? "") && !(data.instagramUrl?.trim() ?? "");

  let instagramHandle = data.instagramHandle;
  let instagramUrl = data.instagramUrl;

  if (noIg && hint.socialUrls.length > 0) {
    const ig = hint.socialUrls.find((u) => inferSocialNetworkFromUrl(u) === "instagram");
    if (ig) {
      const h = extractInstagramHandleFromUrl(ig);
      if (h) {
        instagramHandle = h;
        instagramUrl = `https://instagram.com/${h}`;
      } else {
        instagramUrl = ig.trim();
      }
    }
  }

  if (
    nextPhone === data.phone &&
    nextWebsite === data.website &&
    instagramHandle === data.instagramHandle &&
    instagramUrl === data.instagramUrl
  ) {
    return data;
  }

  return {
    ...data,
    phone: nextPhone,
    website: nextWebsite,
    instagramHandle,
    instagramUrl,
  };
}
