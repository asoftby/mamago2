import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import { prisma } from "@/lib/prisma";
import { buildProfileStatePayload } from "@/lib/post-auth/profileCompletion";

/**
 * GET /api/me/profile-state
 * Агрегат для post-auth completion: флаги + resume step + дети.
 */
export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const children = await prisma.child.findMany({
      where: { parentId: user.id },
      include: { systemInterests: true },
      orderBy: { createdAt: "asc" },
    });

    const payload = buildProfileStatePayload(user, children);
    return NextResponse.json(payload);
  } catch (error) {
    console.error("profile-state error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
