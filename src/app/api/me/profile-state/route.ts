import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import { prisma } from "@/lib/prisma";
import { buildProfileStatePayload } from "@/lib/post-auth/profileCompletion";

/**
 * GET /api/me/profile-state
 * Агрегат для post-auth completion: флаги + resume step + дети.
 */
export async function GET() {
  const totalStart = performance.now();
  try {
    const authStart = performance.now();
    const user = await getCurrentUser();
    if (process.env.NODE_ENV === "development") {
      console.debug(`[profile-state] auth: ${(performance.now() - authStart).toFixed(0)}ms`);
    }
    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const dbStart = performance.now();
    const children = await prisma.child.findMany({
      where: { parentId: user.id },
      include: { systemInterests: true },
      orderBy: { createdAt: "asc" },
    });
    if (process.env.NODE_ENV === "development") {
      console.debug(`[profile-state] db: ${(performance.now() - dbStart).toFixed(0)}ms`);
    }

    const payloadStart = performance.now();
    const payload = buildProfileStatePayload(user, children);
    if (process.env.NODE_ENV === "development") {
      console.debug(`[profile-state] buildPayload: ${(performance.now() - payloadStart).toFixed(0)}ms`);
    }

    if (process.env.NODE_ENV === "development") {
      console.debug(`[profile-state] total: ${(performance.now() - totalStart).toFixed(0)}ms`);
    }
    return NextResponse.json(payload);
  } catch (error) {
    console.error("profile-state error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
