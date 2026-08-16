import { existsSync } from "fs";
import { readFile } from "fs/promises";
import { join } from "path";
import { NextResponse } from "next/server";
import sharp from "sharp";

import { getBrandingConfig } from "@/lib/branding";
import { resolveStoredMediaPath } from "@/server/media/media-storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FAVICON_SIZE = 64;
/** Same static asset the header logo falls back to — always present in the repo, so a default favicon never depends on the DB/uploads. */
const DEFAULT_FAVICON_SOURCE_PATH = join(process.cwd(), "public", "favico_mamago.webp");

async function readFaviconSourceBuffer(faviconUrl: string | null): Promise<Buffer | null> {
  if (faviconUrl) {
    const absolutePath = resolveStoredMediaPath(faviconUrl);
    if (absolutePath && existsSync(absolutePath)) {
      return readFile(absolutePath);
    }
  }

  if (existsSync(DEFAULT_FAVICON_SOURCE_PATH)) {
    return readFile(DEFAULT_FAVICON_SOURCE_PATH);
  }

  return null;
}

export async function GET() {
  const branding = await getBrandingConfig();
  const sourceBuffer = await readFaviconSourceBuffer(branding.faviconUrl);

  if (!sourceBuffer) {
    return new NextResponse(null, {
      status: 404,
      headers: { "Cache-Control": "no-store, max-age=0" },
    });
  }

  let pngBuffer: Buffer;
  try {
    pngBuffer = await sharp(sourceBuffer)
      .resize(FAVICON_SIZE, FAVICON_SIZE, { fit: "cover" })
      .png()
      .toBuffer();
  } catch (error) {
    console.error("[favicon] failed to render favicon:", error);
    return new NextResponse(null, {
      status: 404,
      headers: { "Cache-Control": "no-store, max-age=0" },
    });
  }

  const isVersionedBrandedFavicon = Boolean(branding.faviconUrl && branding.faviconVersion);

  return new NextResponse(new Uint8Array(pngBuffer), {
    headers: {
      "Content-Type": "image/png",
      "Content-Length": pngBuffer.length.toString(),
      // The route href carries `?v=<faviconVersion>` when a branding favicon
      // is set (see getBrandingFaviconRouteHref) — safe to cache immutably,
      // a new upload changes the version and therefore the URL. Unversioned
      // (default-asset) responses use a short max-age instead.
      "Cache-Control": isVersionedBrandedFavicon
        ? "public, max-age=31536000, immutable"
        : "public, max-age=300",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
