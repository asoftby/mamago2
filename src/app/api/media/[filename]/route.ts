/**
 * Media Proxy Route
 * 
 * Serves media files with correct Content-Type headers.
 * Fixes issue where .blob files download instead of displaying.
 */

import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import { existsSync } from "fs";
import { prisma } from "@/lib/prisma";
import {
  resolveLegacyPublicUploadPath,
  resolveStoredMediaPath,
} from "@/server/media/media-storage";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ filename: string }> }
) {
  try {
    const { filename } = await params;
    
    // Find media asset by filename
    const media = await prisma.mediaAsset.findFirst({
      where: {
        OR: [
          { filename },
          { storageKey: { endsWith: filename } },
        ],
      },
    });

    if (!media) {
      return new NextResponse("Not found", { status: 404 });
    }

    // Get file path
    const filepath =
      resolveStoredMediaPath(media.publicUrl) ??
      resolveStoredMediaPath(media.storageKey) ??
      resolveLegacyPublicUploadPath(media.publicUrl) ??
      resolveLegacyPublicUploadPath(media.storageKey);

    if (!filepath || !existsSync(filepath)) {
      return new NextResponse("File not found", { status: 404 });
    }

    // Read file
    const fileBuffer = await readFile(filepath);

    // Return with correct Content-Type
    return new NextResponse(fileBuffer, {
      headers: {
        "Content-Type": media.mimeType || "application/octet-stream",
        "Content-Length": fileBuffer.length.toString(),
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch (error) {
    console.error("Media proxy error:", error);
    return new NextResponse("Internal server error", { status: 500 });
  }
}
