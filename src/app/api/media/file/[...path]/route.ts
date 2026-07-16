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
import type { MediaAsset } from "@prisma/client";
import type { AuthActor } from "@/lib/auth/safeUser";
import {
  buildMediaFileAccessDenyPayload,
  canLoadMediaAnonymously,
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
      user?: AuthActor | null;
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
      console.warn(`[media-file] file not on disk: path="${relativePath}"`);
      await devLogDeny({ media: null, denyReason: "FILE_NOT_ON_DISK" });
      return new NextResponse(
        JSON.stringify({ error: "file not found", path: relativePath }),
        { status: 404, headers: { "Content-Type": "application/json" } },
      );
    }

    let media = await findMediaAssetByStorageRelativePath(pathSegments);
    if (!media) {
      media = await ensureMediaAssetForExistingPlaceImageFile(pathSegments);
    }

    if (!media) {
      console.warn(`[media-file] no media asset record for path: "${relativePath}"`);
      await devLogDeny({ media: null, denyReason: "MEDIA_ASSET_NOT_FOUND" });
      return new NextResponse(
        JSON.stringify({ error: "media asset not found", path: relativePath }),
        { status: 404, headers: { "Content-Type": "application/json" } },
      );
    }

    const authorizedPath =
      resolveStoredMediaPath(media.publicUrl) ??
      resolveStoredMediaPath(media.storageKey) ??
      resolveLegacyPublicUploadPath(media.publicUrl) ??
      resolveLegacyPublicUploadPath(media.storageKey);

    if (!authorizedPath || authorizedPath !== absolutePath) {
      console.warn(
        `[media-file] storage path mismatch: mediaId="${media.id}" requested="${absolutePath}" authorized="${authorizedPath}"`,
      );
      await devLogDeny({ media, denyReason: "STORAGE_PATH_MISMATCH" });
      return new NextResponse(
        JSON.stringify({ error: "storage path mismatch", mediaId: media.id }),
        { status: 404, headers: { "Content-Type": "application/json" } },
      );
    }

    const user = await getCurrentUser();
    const isPubliclyServable = await canLoadMediaAnonymously(media);
    const canServe = isPubliclyServable || (await canServeMediaResponse(media, user));
    if (!canServe) {
      await devLogDeny({
        media,
        denyReason: "CAN_SERVE_MEDIA_DENIED",
        user,
      });
      return new NextResponse(
        JSON.stringify({ error: "access denied" }),
        { status: 404, headers: { "Content-Type": "application/json" } },
      );
    }

    const [fileBuffer, fileStat] = await Promise.all([
      readFile(absolutePath),
      stat(absolutePath),
    ]);
    const filename = pathSegments[pathSegments.length - 1] ?? "file";

    // Only genuinely public (published + anonymously-servable) media may use
    // a shared/CDN-cacheable directive. A response reachable solely via
    // canServeMediaResponse()'s authenticated-user branch (e.g. an admin
    // previewing a PENDING Place) must never be marked `public` — a shared
    // cache serving those bytes to a later, unauthorized requester would
    // silently bypass the access check entirely.
    const cacheControl = isPubliclyServable
      ? "public, max-age=31536000, immutable"
      : "private, no-store";

    return new NextResponse(fileBuffer, {
      headers: {
        "Content-Type": mimeTypeFromFilename(filename),
        "Content-Length": fileStat.size.toString(),
        "Cache-Control": cacheControl,
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("Media file route error:", error);
    return new NextResponse("Internal server error", { status: 500 });
  }
}
