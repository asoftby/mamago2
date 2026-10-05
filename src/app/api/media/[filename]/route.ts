/**
 * Media Proxy Route
 *
 * Serves media files with correct Content-Type headers.
 * Access: published linkage or authenticated owner/team/admin.
 */

import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import { existsSync } from "fs";
import { parse as parsePath, join as joinPath } from "path";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/server";
import {
  resolveLegacyPublicUploadPath,
  resolveStoredMediaPath,
} from "@/server/media/media-storage";
import {
  canLoadMediaAnonymously,
  canServeMediaResponse,
} from "@/server/media/mediaPublicAccess";
import { decideMediaResponsePolicy } from "@/server/media/mediaResponsePolicy";

const MEDIA_PREVIEW_VARIANTS = new Set(["sm", "md", "lg", "xl"]);

function resolveResponsiveVariantPath(masterPath: string, variant: string | null): string {
  if (!variant) return masterPath;
  if (!MEDIA_PREVIEW_VARIANTS.has(variant)) return masterPath;

  const parsed = parsePath(masterPath);
  const candidate = joinPath(parsed.dir, `${parsed.name}-${variant}.webp`);
  return existsSync(candidate) ? candidate : masterPath;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ filename: string }> },
) {
  try {
    const { filename } = await params;
    if (!filename?.trim()) {
      return new NextResponse("Not found", { status: 404 });
    }

    const media = await prisma.mediaAsset.findFirst({
      where: {
        OR: [
          { id: filename },
          { filename },
          { storageKey: { endsWith: filename } },
        ],
      },
    });

    if (!media) {
      console.warn(`[media-api] media record not found: lookup="${filename}"`);
      return new NextResponse(
        JSON.stringify({ error: "media not found", lookup: filename }),
        { status: 404, headers: { "Content-Type": "application/json" } },
      );
    }

    const user = await getCurrentUser();
    const publiclyServable = await canLoadMediaAnonymously(media);
    const authorizedToServe =
      publiclyServable || (await canServeMediaResponse(media, user));
    const responsePolicy = decideMediaResponsePolicy({
      publiclyServable,
      authorizedToServe,
    });
    if (!responsePolicy.canServe) {
      return new NextResponse(
        JSON.stringify({ error: "access denied" }),
        { status: 404, headers: { "Content-Type": "application/json" } },
      );
    }

    const filepath =
      resolveStoredMediaPath(media.publicUrl) ??
      resolveStoredMediaPath(media.storageKey) ??
      resolveLegacyPublicUploadPath(media.publicUrl) ??
      resolveLegacyPublicUploadPath(media.storageKey);

    if (!filepath || !existsSync(filepath)) {
      console.warn(
        `[media-api] file missing on disk: mediaId="${media.id}" publicUrl="${media.publicUrl}" storageKey="${media.storageKey}" resolvedPath="${filepath}"`,
      );
      return new NextResponse(
        JSON.stringify({ error: "file missing on disk", mediaId: media.id }),
        { status: 404, headers: { "Content-Type": "application/json" } },
      );
    }

    const variant = request.nextUrl.searchParams.get("variant")?.trim().toLowerCase() || null;
    const responsePath = resolveResponsiveVariantPath(filepath, variant);
    const fileBuffer = await readFile(responsePath);

    return new NextResponse(fileBuffer, {
      headers: {
        "Content-Type":
          responsePath === filepath
            ? media.mimeType || "application/octet-stream"
            : "image/webp",
        "Content-Length": fileBuffer.length.toString(),
        "Cache-Control": responsePolicy.cacheControl,
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("Media proxy error:", error);
    return new NextResponse("Internal server error", { status: 500 });
  }
}
