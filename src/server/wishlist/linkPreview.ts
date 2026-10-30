import "server-only";

import { assertSafeRemoteImageUrl } from "@/lib/media/safeRemoteImageUrl";
import { uploadImageFromUrl } from "@/lib/upload/uploadFromUrl";
import { fetchHtml } from "@/server/modules/import/parsers/fetchHtml";

import { extractLinkPreview } from "./linkPreviewPure";

export type LinkPreview = {
  title: string | null;
  /** Already stored on our side (never hotlinked from the shop). */
  imageUrl: string | null;
};

const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

/**
 * Fetches a preview for an arbitrary public product link. Reuses the pinned,
 * DNS-classified import transport (SSRF safe, every redirect hop revalidated).
 * Returns null when the shop blocks us, times out, or the page has nothing
 * usable — the caller then keeps the manual title/photo.
 */
export async function fetchLinkPreview(url: string, ownerUserId: string): Promise<LinkPreview | null> {
  let page;
  try {
    page = await fetchHtml(url, {
      timeoutMs: 6_000,
      retries: 1,
      maxBytes: 1_500_000,
      maxRedirects: 4,
      headers: { "User-Agent": BROWSER_UA, "Accept-Language": "ru,en;q=0.8" },
    });
  } catch {
    return null;
  }
  if (page.status >= 400) return null;
  const extracted = extractLinkPreview(page.html, page.finalUrl);

  let imageUrl: string | null = null;
  if (extracted.imageUrl) {
    try {
      const stored = await uploadImageFromUrl(extracted.imageUrl, {
        validateUrl: (candidate) => assertSafeRemoteImageUrl(candidate.toString()),
        dedupOwnerId: ownerUserId,
        maxWidthOrHeight: 640,
        quality: 80,
      });
      imageUrl = stored.url;
    } catch {
      imageUrl = null;
    }
  }
  if (!extracted.title && !imageUrl) return null;
  return { title: extracted.title, imageUrl };
}
