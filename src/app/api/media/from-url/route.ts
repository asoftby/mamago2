/**
 * POST /api/media/from-url
 * Imports a public remote image into the media pipeline.
 */

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import {
  checkBusinessToolPermission,
  isPlatformContentStaff,
} from "@/server/permissions/business-permissions";
import { MediaSourceType } from "@prisma/client";
import { registerUploadedMedia } from "@/lib/media/mediaRegistry";
import { processImage, DEFAULT_IMAGE_CONFIG } from "@/lib/media/imageProcessor";
import { buildMasterFilename, buildMediaStem, buildResponsiveFilename } from "@/server/media/mediaNaming";
import { assertSafeRemoteImageUrl } from "@/lib/media/safeRemoteImageUrl";
import { buildNeutralImportedMediaIdentity } from "@/lib/media/importedMediaPrivacy";
import { writeRuntimeUpload } from "@/server/media/media-storage";
import { describeFetchError, fetchBinary } from "@/server/modules/import/parsers/fetchHtml";

export const runtime = "nodejs";
export const maxDuration = 45;

const MAX_BYTES = 10 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 25_000;

function mimeFromContentType(header: string | null | undefined): string {
  if (!header) return "application/octet-stream";
  return header.split(";")[0]?.trim().toLowerCase() || "application/octet-stream";
}

function errorHttpStatus(error: unknown): number | undefined {
  if (!error || typeof error !== "object") return undefined;
  const value = (error as { httpStatus?: unknown }).httpStatus;
  return typeof value === "number" ? value : undefined;
}

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    if (!(await checkBusinessToolPermission(user, "content.create"))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json().catch(() => null);
    const urlRaw = body && typeof body.url === "string" ? body.url : "";
    const url = assertSafeRemoteImageUrl(urlRaw);

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
    const mediaIdentity = buildNeutralImportedMediaIdentity(url);
    const uploadStem = buildMediaStem({ type: "CONTEXTLESS" });
    const masterSaved = await writeRuntimeUpload(
      buildMasterFilename(uploadStem),
      processedImageSet.master.buffer,
    );

    for (const [sizeName, sizeData] of Object.entries(processedImageSet.sizes)) {
      if (sizeData) {
        await writeRuntimeUpload(buildResponsiveFilename(uploadStem, sizeName), sizeData.buffer);
      }
    }

    const sourceType = isPlatformContentStaff(user.role)
      ? MediaSourceType.ADMIN_UPLOAD
      : MediaSourceType.BUSINESS_UPLOAD;

    const asset = await registerUploadedMedia({
      filename: masterSaved.filename,
      originalName: mediaIdentity.originalName,
      mimeType: "image/webp",
      sizeBytes: processedImageSet.master.size,
      width: processedImageSet.master.width,
      height: processedImageSet.master.height,
      storageKey: masterSaved.publicUrl,
      publicUrl: masterSaved.publicUrl,
      sourceType,
      uploadedById: user.id,
      title: uploadStem,
    });

    return NextResponse.json({
      mediaId: asset.id,
      publicUrl: asset.publicUrl,
      width: processedImageSet.master.width,
      height: processedImageSet.master.height,
    });
  } catch (e: unknown) {
    const httpStatus = errorHttpStatus(e);
    const msg = e instanceof Error ? e.message : "Import failed";
    if (httpStatus === 400) return NextResponse.json({ error: msg }, { status: 400 });
    if (httpStatus === 504 || (e instanceof Error && e.name === "AbortError")) {
      console.warn("media/from-url: timed out", { error: describeFetchError(e) });
      return NextResponse.json({ error: "Превышено время загрузки" }, { status: 504 });
    }
    if (httpStatus === 502) {
      console.error("media/from-url: upstream fetch failed", { error: describeFetchError(e) });
      return NextResponse.json({ error: "Не удалось скачать изображение" }, { status: 502 });
    }
    console.error("media/from-url:", e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
