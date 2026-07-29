import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/server";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ routeId: string }> },
) {
  try {
    const { routeId } = await params;

    if (!routeId) {
      return NextResponse.json({ error: "Missing routeId" }, { status: 400 });
    }

    const user = await getCurrentUser();
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      req.headers.get("x-real-ip") ??
      "anonymous";
    const identifier = user?.id ?? `ip:${ip}`;

    const [counts, existing] = await Promise.all([
      prisma.routeRating.groupBy({
        by: ["ratingType"],
        where: { routeId },
        _count: true,
      }),
      prisma.routeRating.findUnique({
        where: { routeId_identifier: { routeId, identifier } },
        select: { ratingType: true },
      }),
    ]);

    const result = { like: 0, neutral: 0, dislike: 0 };
    for (const c of counts) {
      result[c.ratingType as keyof typeof result] = c._count;
    }

    return NextResponse.json({
      ...result,
      myVote: existing?.ratingType ?? null,
    });
  } catch (error) {
    console.error("Failed to get route ratings:", error);
    return NextResponse.json({ like: 0, neutral: 0, dislike: 0, myVote: null });
  }
}
