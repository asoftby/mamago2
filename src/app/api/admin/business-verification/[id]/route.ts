import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import prisma from "@/lib/prisma";

export const runtime = "nodejs";

/**
 * GET /api/admin/business-verification/[id]
 * Get business details with verification logs
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { ok: false, error: "Требуется авторизация" },
        { status: 401 }
      );
    }

    // Check admin/moderator role
    if (user.role !== "ADMIN" && user.role !== "MODERATOR") {
      return NextResponse.json(
        { ok: false, error: "Доступ запрещен" },
        { status: 403 }
      );
    }

    const { id } = await params;

    // Fetch business with logs
    const business = await prisma.business.findUnique({
      where: { id },
      include: {
        owner: {
          select: {
            id: true,
            email: true,
            phoneE164: true,
            createdAt: true,
          },
        },
        verificationLogs: {
          include: {
            reviewedBy: {
              select: {
                id: true,
                email: true,
              },
            },
          },
          orderBy: {
            createdAt: "desc",
          },
        },
      },
    });

    if (!business) {
      return NextResponse.json(
        { ok: false, error: "Бизнес не найден" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      ok: true,
      business,
      /** Видимость (operationalStatus) меняет только ADMIN — см. PATCH /api/admin/business/[id]/status */
      canManageBusinessVisibility: user.role === "ADMIN",
    });
  } catch (error) {
    console.error("[admin/business-verification/[id]] Error:", error);
    return NextResponse.json(
      { ok: false, error: "Внутренняя ошибка сервера" },
      { status: 500 }
    );
  }
}
