/**
 * Media Proxy Route
 *
 * Serves media files with correct Content-Type headers.
 * Access: published linkage or authenticated owner/team/admin.
 */

import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import { existsSync } from "fs";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/server";
import {
  resolveLegacyPublicUploadPath,
  resolveStoredMediaPath,
} from "@/server/media/media-storage";
import { canServeMediaResponse } from "@/server/media/mediaPublicAccess";

export async function GET(
  _request: NextRequest,
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
    if (!(await canServeMediaResponse(media, user))) {
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

    const fileBuffer = await readFile(filepath);

    return new NextResponse(fileBuffer, {
      headers: {
        "Content-Type": media.mimeType || "application/octet-stream",
        "Content-Length": fileBuffer.length.toString(),
        "Cache-Control": "public, max-age=31536000, immutable",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("Media proxy error:", error);
    return new NextResponse("Internal server error", { status: 500 });
  }
}
