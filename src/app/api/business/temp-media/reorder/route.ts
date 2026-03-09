import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { wizardSessionId, updates } = await req.json();

    if (!wizardSessionId || !Array.isArray(updates)) {
      return NextResponse.json(
        { error: "wizardSessionId and updates array required" },
        { status: 400 }
      );
    }

    // Update sortOrder for each media item
    // Only update media that belongs to this user and session
    await Promise.all(
      updates.map(({ id, sortOrder }: { id: string; sortOrder: number }) =>
        prisma.tempMedia.updateMany({
          where: {
            id,
            wizardSessionId,
            ownerUserId: user.id, // Security: only update user's own media
          },
          data: {
            sortOrder,
          },
        })
      )
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[temp-media/reorder] Error:", error);
    return NextResponse.json(
      { error: "Failed to reorder images" },
      { status: 500 }
    );
  }
}
