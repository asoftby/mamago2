/**
 * PATCH /api/admin/media/[id] - Update media metadata
 * DELETE /api/admin/media/[id] - Delete media file
 */

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import prisma from "@/lib/prisma";
import { unlink } from "fs/promises";
import { join } from "path";
import { existsSync } from "fs";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();

    if (!user || user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await req.json();
    const { alt, title, caption } = body;

    // Update metadata
    const updated = await prisma.mediaAsset.update({
      where: { id },
      data: {
        alt: alt || null,
        title: title || null,
        caption: caption || null,
      },
    });

    return NextResponse.json(updated);
  } catch (error: any) {
    console.error("Update media error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to update media" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();

    if (!user || user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    // Check if media exists
    const media = await prisma.mediaAsset.findUnique({
      where: { id },
      include: {
        usages: true,
      },
    });

    if (!media) {
      return NextResponse.json({ error: "Media not found" }, { status: 404 });
    }

    // Check if media is in use
    if (media.usages.length > 0) {
      return NextResponse.json(
        { error: "Cannot delete media that is in use" },
        { status: 400 }
      );
    }

    // Delete file from filesystem
    if (media.publicUrl) {
      const filePath = join(process.cwd(), "public", media.publicUrl);
      if (existsSync(filePath)) {
        try {
          await unlink(filePath);
        } catch (err) {
          console.error("Failed to delete file:", err);
        }
      }
    }

    // Delete from database
    await prisma.mediaAsset.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Delete media error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to delete media" },
      { status: 500 }
    );
  }
}
