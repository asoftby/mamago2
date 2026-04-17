/**
 * PATCH /api/admin/media/[id] - Update media metadata
 * DELETE /api/admin/media/[id] - Delete media file
 */

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import prisma from "@/lib/prisma";
import { hardDeleteMediaAssetIfUnused } from "@/server/services/media/media.service";

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
  } catch (error: unknown) {
    console.error("Update media error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update media" },
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

    const result = await hardDeleteMediaAssetIfUnused(id);

    if (!result.ok) {
      if (result.reason === "not_found") {
        return NextResponse.json({ error: "Media not found" }, { status: 404 });
      }
      return NextResponse.json(
        { error: "Cannot delete media that is in use" },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error("Delete media error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to delete media" },
      { status: 500 }
    );
  }
}
