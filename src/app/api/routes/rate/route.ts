import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/server";

export async function POST(req: NextRequest) {
  try {
    const { routeId, ratingType } = await req.json();

    if (!routeId || !ratingType) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    if (!["like", "neutral", "dislike"].includes(ratingType)) {
      return NextResponse.json({ error: "Invalid rating type" }, { status: 400 });
    }

    const user = await getCurrentUser();
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      req.headers.get("x-real-ip") ??
      "anonymous";
    const identifier = user?.id ?? `ip:${ip}`;

    const existing = await prisma.routeRating.findUnique({
      where: { routeId_identifier: { routeId, identifier } },
    });

    if (existing) {
      return NextResponse.json({ error: "Already voted" }, { status: 409 });
    }

    await prisma.routeRating.create({
      data: {
        routeId,
        ratingType,
        identifier,
        userId: user?.id ?? null,
      },
    });

    const counts = await prisma.routeRating.groupBy({
      by: ["ratingType"],
      where: { routeId },
      _count: true,
    });

    const result = { like: 0, neutral: 0, dislike: 0 };
    for (const c of counts) {
      result[c.ratingType as keyof typeof result] = c._count;
    }

    return NextResponse.json({ ok: true, counts: result });
  } catch (error) {
    console.error("Failed to rate route:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
