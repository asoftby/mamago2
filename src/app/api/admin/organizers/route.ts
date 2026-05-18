import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/server";
import { parsePaginationParams } from "@/lib/api/pagination";
import { Prisma } from "@prisma/client";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ ok: false, error: "Требуется авторизация" }, { status: 401 });
    }

    if (!["ADMIN", "MODERATOR", "BUSINESS_OWNER"].includes(user.role)) {
      return NextResponse.json({ ok: false, error: "Доступ запрещен" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const query = (searchParams.get("query") ?? searchParams.get("q") ?? "").trim();
    const { limit } = parsePaginationParams(searchParams, { defaultLimit: 10, maxLimit: 30 });

    const organizers = await prisma.organizer.findMany({
      where: query
        ? {
            OR: [
              { name: { contains: query, mode: Prisma.QueryMode.insensitive } },
              { phone: { contains: query, mode: Prisma.QueryMode.insensitive } },
              { website: { contains: query, mode: Prisma.QueryMode.insensitive } },
              { instagram: { contains: query, mode: Prisma.QueryMode.insensitive } },
            ],
          }
        : undefined,
      orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
      take: limit,
      select: {
        id: true,
        name: true,
        unp: true,
        phone: true,
        website: true,
        instagram: true,
        createdFrom: true,
        linkedBusinessId: true,
      },
    });

    return NextResponse.json({
      ok: true,
      organizers: organizers.map((organizer) => ({
        id: organizer.id,
        name: organizer.name,
        unp: organizer.unp ?? undefined,
        phone: organizer.phone ?? undefined,
        website: organizer.website ?? undefined,
        instagram: organizer.instagram ?? undefined,
        createdFrom: organizer.createdFrom === "IMPORT" ? "import" : "manual",
        linkedBusinessId: organizer.linkedBusinessId,
      })),
    });
  } catch (error) {
    console.error("[admin/organizers] Error:", error);
    return NextResponse.json({ ok: false, error: "Внутренняя ошибка сервера" }, { status: 500 });
  }
}
