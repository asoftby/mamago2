import { NextResponse } from "next/server";
import { existsSync } from "fs";
import { readFile, stat } from "fs/promises";
import {
  mimeTypeFromFilename,
  resolveMediaStorageAbsolutePath,
} from "@/server/media/media-storage";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ path: string[] }> },
) {
  try {
    const { path } = await params;
    const relativePath = path.join("/");
    const absolutePath = resolveMediaStorageAbsolutePath(relativePath);

    if (!absolutePath || !existsSync(absolutePath)) {
      return new NextResponse("Not found", { status: 404 });
    }

    const [fileBuffer, fileStat] = await Promise.all([readFile(absolutePath), stat(absolutePath)]);
    const filename = path[path.length - 1] ?? "file";

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
