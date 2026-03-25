import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/server";
import { Prisma } from "@prisma/client";

export const runtime = "nodejs";

type ApiBusiness = {
  id: string;
  name: string;
  unp: string | null;
  phone: string | null;
  owner: {
    email: string;
    phoneE164: string | null;
  };
};

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ ok: false, error: "Требуется авторизация" }, { status: 401 });
    }

    // Allow organizer search for business/admin/moderator users.
    if (!["ADMIN", "MODERATOR", "BUSINESS_OWNER"].includes(user.role)) {
      return NextResponse.json({ ok: false, error: "Доступ запрещен" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const query = (searchParams.get("query") ?? searchParams.get("q") ?? "").trim();
    const limitRaw = searchParams.get("limit") ?? "10";
    const limit = Math.max(1, Math.min(30, Number(limitRaw) || 10));

    const businesses = await prisma.business.findMany({
      where: {
        verificationStatus: "APPROVED",
        ...(query
          ? {
              OR: [
                { name: { contains: query, mode: Prisma.QueryMode.insensitive } },
                { unp: { contains: query, mode: Prisma.QueryMode.insensitive } },
                { owner: { email: { contains: query, mode: Prisma.QueryMode.insensitive } } },
              ],
            }
          : undefined),
      },
      take: limit,
      include: {
        owner: {
          select: {
            email: true,
            phoneE164: true,
          },
        },
      },
      orderBy: {
        updatedAt: "desc",
      },
    });

    const organizers = businesses.map((b): { id: string; name: string; phone?: string; isVerified: boolean } => ({
      id: b.id,
      name: b.name,
      // Prefer Business.phone, fallback to owner's phoneE164.
      phone: b.phone || b.owner.phoneE164 || undefined,
      isVerified: true,
    }));

    return NextResponse.json({ ok: true, organizers });
  } catch (error) {
    console.error("[admin/b2b/partners] Error:", error);
    return NextResponse.json({ ok: false, error: "Внутренняя ошибка сервера" }, { status: 500 });
  }
}

