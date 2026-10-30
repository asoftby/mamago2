import "server-only";

import { readFile } from "fs/promises";

import { mimeTypeFromFilename, resolveStoredMediaPath } from "@/server/media/media-storage";

import { isStoredMediaUrl } from "./wishlistPure";

/** No SVG: it can carry scripts. */
const SERVABLE = new Set(["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"]);

/** Bytes of a preview photo we stored ourselves, or null (external link, missing file, wrong type). */
export async function readStoredWishlistImage(
  imageUrl: string | null,
): Promise<{ body: Uint8Array; contentType: string } | null> {
  if (!imageUrl || !isStoredMediaUrl(imageUrl)) return null;
  const absolute = resolveStoredMediaPath(imageUrl);
  if (!absolute) return null;
  const contentType = mimeTypeFromFilename(absolute);
  if (!SERVABLE.has(contentType)) return null;
  try {
    return { body: new Uint8Array(await readFile(absolute)), contentType };
  } catch {
    return null;
  }
}

export function wishlistImageResponse(image: { body: Uint8Array; contentType: string } | null): Response {
  if (!image) return new Response(JSON.stringify({ error: "not_found" }), { status: 404, headers: { "Content-Type": "application/json" } });
  return new Response(image.body as BodyInit, {
    status: 200,
    headers: {
      "Content-Type": image.contentType,
      "Cache-Control": "private, max-age=3600",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
    },
  });
}
