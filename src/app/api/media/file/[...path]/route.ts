import { NextResponse } from "next/server";
import { existsSync } from "fs";
import { readFile, stat } from "fs/promises";
import { getCurrentUser } from "@/lib/auth/server";
import {
  mimeTypeFromFilename,
  resolveLegacyPublicUploadPath,
  resolveMediaStorageAbsolutePath,
  resolveStoredMediaPath,
} from "@/server/media/media-storage";
import { logMediaAccessDeny } from "@/server/media/mediaAccessDenyLog";
import type { MediaAsset, User } from "@prisma/client";
import {
  buildMediaFileAccessDenyPayload,
  canServeMediaResponse,
  ensureMediaAssetForExistingPlaceImageFile,
  findMediaAssetByStorageRelativePath,
} from "@/server/media/mediaPublicAccess";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ path: string[] }> },
) {
  try {
    const { path: pathSegments } = await params;
    const relativePath = pathSegments.join("/");
    const absolutePath = resolveMediaStorageAbsolutePath(relativePath);
    const fileExists = Boolean(absolutePath && existsSync(absolutePath));

    const devLogDeny = async (args: {
      media: MediaAsset | null;
      denyReason: string;
      user?: User | null;
    }) => {
      if (process.env.NODE_ENV !== "development") {
        return;
      }
      logMediaAccessDeny(
        await buildMediaFileAccessDenyPayload({
          pathSegments,
          storageAbsolutePath: absolutePath,
          fileExists,
          media: args.media,
          user:
            args.user !== undefined ? args.user : await getCurrentUser(),
          denyReason: args.denyReason,
        }),
      );
    };

    if (!absolutePath || !fileExists) {
      await devLogDeny({ media: null, denyReason: "FILE_NOT_ON_DISK" });
      return new NextResponse("Not found", { status: 404 });
    }

    let media = await findMediaAssetByStorageRelativePath(pathSegments);
    if (!media) {
      media = await ensureMediaAssetForExistingPlaceImageFile(pathSegments);
    }

    if (!media) {
      await devLogDeny({ media: null, denyReason: "MEDIA_ASSET_NOT_FOUND" });
      return new NextResponse("Not found", { status: 404 });
    }

    const authorizedPath =
      resolveStoredMediaPath(media.publicUrl) ??
      resolveStoredMediaPath(media.storageKey) ??
      resolveLegacyPublicUploadPath(media.publicUrl) ??
      resolveLegacyPublicUploadPath(media.storageKey);

    if (!authorizedPath || authorizedPath !== absolutePath) {
      await devLogDeny({ media, denyReason: "STORAGE_PATH_MISMATCH" });
      return new NextResponse("Not found", { status: 404 });
    }

    const user = await getCurrentUser();
    if (!(await canServeMediaResponse(media, user))) {
      await devLogDeny({
        media,
        denyReason: "CAN_SERVE_MEDIA_DENIED",
        user,
      });
      return new NextResponse("Not found", { status: 404 });
    }

    const [fileBuffer, fileStat] = await Promise.all([
      readFile(absolutePath),
      stat(absolutePath),
    ]);
    const filename = pathSegments[pathSegments.length - 1] ?? "file";

    return new NextResponse(fileBuffer, {
      headers: {
        "Content-Type": mimeTypeFromFilename(filename),
        "Content-Length": fileStat.size.toString(),
        "Cache-Control": "public, max-age=31536000, immutable",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("Media file route error:", error);
    return new NextResponse("Internal server error", { status: 500 });
  }
}
