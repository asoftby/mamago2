/**
 * POST /api/media/from-url
 * Скачивает изображение по публичному URL, прогоняет pipeline как /api/upload, создаёт MediaAsset.
 * Только по явному действию пользователя (импорт / редактор).
 */

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import { canCreateBusinessContent } from "@/lib/auth/businessContentAccess";
import { MediaSourceType } from "@prisma/client";
import { registerUploadedMedia } from "@/lib/media/mediaRegistry";
import {
  processImage,
  generateProcessedFilename,
  DEFAULT_IMAGE_CONFIG,
} from "@/lib/media/imageProcessor";
import { assertSafeRemoteImageUrl } from "@/lib/media/safeRemoteImageUrl";
import { writeRuntimeUpload } from "@/server/media/media-storage";
import { describeFetchError, fetchBinary } from "@/server/modules/import/parsers/fetchHtml";

export const runtime = "nodejs";
export const maxDuration = 45;

const MAX_BYTES = 10 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 25_000;

function mimeFromContentType(header: string | null | undefined): string {
  if (!header) return "application/octet-stream";
  const base = header.split(";")[0]?.trim().toLowerCase() ?? "";
  return base || "application/octet-stream";
}

/**
 * Every controlled error along the fetch/validation path (SSRF rejection,
 * redirect limit, size limit, TLS/network failure, timeout) is tagged with
 * `httpStatus` at the throw site — see safeRemoteImageUrl.ts and fetchHtml.ts
 * (`fetchBinary`). This avoids classifying errors by matching message text.
 */
function errorHttpStatus(error: unknown): number | undefined {
  if (!error || typeof error !== "object") return undefined;
  const value = (error as { httpStatus?: unknown }).httpStatus;
  return typeof value === "number" ? value : undefined;
}

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const allowed =
      user.role === "ADMIN" ||
      user.role === "MODERATOR" ||
      canCreateBusinessContent(user.role);
    if (!allowed) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json().catch(() => null);
    const urlRaw = body && typeof body.url === "string" ? body.url : "";
    const url = assertSafeRemoteImageUrl(urlRaw);

    // `validateUrl` is called for the initial URL and again for every
    // redirect hop inside fetchBinary, so a redirect can't be used to reach
    // a private/reserved host that the initial check would have rejected.
    const remote = await fetchBinary(url.toString(), {
      timeoutMs: FETCH_TIMEOUT_MS,
      maxBytes: MAX_BYTES,
      headers: {
        Accept: "image/*,*/*;q=0.8",
        "User-Agent": "MamaGoMediaImporter/1.0",
      },
      validateUrl: (candidate) => {
        assertSafeRemoteImageUrl(candidate.toString());
      },
    });

    const buf = remote.buffer;
    let mime = mimeFromContentType(remote.headers["content-type"]);
    if (mime === "application/octet-stream" || !mime.startsWith("image/")) {
      if (buf[0] === 0xff && buf[1] === 0xd8) mime = "image/jpeg";
      else if (buf[0] === 0x89 && buf[1] === 0x50) mime = "image/png";
      else if (buf[0] === 0x52 && buf[1] === 0x49) mime = "image/webp";
    }

    if (!mime.startsWith("image/")) {
      return NextResponse.json({ error: "Ответ не является изображением" }, { status: 400 });
    }

    const processedImageSet = await processImage(buf, mime, DEFAULT_IMAGE_CONFIG);

    const slug = `import-${url.hostname.replace(/[^a-z0-9]+/gi, "-").slice(0, 24)}`;
    const masterSaved = await writeRuntimeUpload(
      generateProcessedFilename(`${slug}.jpg`),
      processedImageSet.master.buffer,
    );
    const masterFilename = masterSaved.filename;
    const masterUrl = masterSaved.publicUrl;

    for (const [sizeName, sizeData] of Object.entries(processedImageSet.sizes)) {
      if (sizeData) {
        await writeRuntimeUpload(generateProcessedFilename(`${slug}.jpg`, sizeName), sizeData.buffer);
      }
    }

    let sourceType: MediaSourceType = MediaSourceType.USER_UPLOAD;
    if (user.role === "ADMIN" || user.role === "MODERATOR") {
      sourceType = MediaSourceType.ADMIN_UPLOAD;
    } else if (user.role === "BUSINESS_OWNER") {
      sourceType = MediaSourceType.BUSINESS_UPLOAD;
    }

    const asset = await registerUploadedMedia({
      filename: masterFilename,
      originalName: url.pathname.split("/").pop() || "import.jpg",
      mimeType: "image/webp",
      sizeBytes: processedImageSet.master.size,
      width: processedImageSet.master.width,
      height: processedImageSet.master.height,
      storageKey: masterUrl,
      publicUrl: masterUrl,
      sourceType,
      uploadedById: user.id,
      title: `Import: ${url.hostname}`,
    });

    return NextResponse.json({
      mediaId: asset.id,
      publicUrl: asset.publicUrl,
      width: processedImageSet.master.width,
      height: processedImageSet.master.height,
      sourceUrl: url.toString(),
    });
  } catch (e: unknown) {
    const httpStatus = errorHttpStatus(e);
    const msg = e instanceof Error ? e.message : "Import failed";

    // 400: bad/unsafe URL, redirect to a private host, too many redirects,
    // or the response exceeded MAX_BYTES — these messages are already
    // user-safe (assertSafeRemoteImageUrl / fetchBinary never put upstream
    // internals in them).
    if (httpStatus === 400) {
      return NextResponse.json({ error: msg }, { status: 400 });
    }

    if (httpStatus === 504 || (e instanceof Error && e.name === "AbortError")) {
      console.warn("media/from-url: timed out", { error: describeFetchError(e) });
      return NextResponse.json({ error: "Превышено время загрузки" }, { status: 504 });
    }

    if (httpStatus === 502) {
      // Network/TLS failure or a non-2xx upstream response. Keep the
      // response generic — the actionable cause (TLS error code, DNS
      // failure, upstream status, etc.) goes to the server log only.
      console.error("media/from-url: upstream fetch failed", { error: describeFetchError(e) });
      return NextResponse.json({ error: "Не удалось скачать изображение" }, { status: 502 });
    }

    console.error("media/from-url:", e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
