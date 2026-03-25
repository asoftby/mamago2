import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import prisma from "@/lib/prisma";
import type { BusinessOperationalStatus } from "@prisma/client";
import { updateBusinessVisibilityStatus } from "@/server/business/updateBusinessVisibilityStatus";

export const runtime = "nodejs";

/**
 * PATCH /api/admin/business/[id]/status
 * Body: { status: "ACTIVE" | "DISABLED" | "ARCHIVED" }
 * Меняет только видимость бизнеса (`operationalStatus`), не заявку на верификацию.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { ok: false, error: "Требуется авторизация" },
        { status: 401 },
      );
    }
    if (user.role !== "ADMIN") {
      return NextResponse.json(
        { ok: false, error: "Доступ запрещён" },
        { status: 403 },
      );
    }

    const { id } = await params;
    const body = await request.json().catch(() => null);
    const raw = body?.status as string | undefined;
    if (raw !== "ACTIVE" && raw !== "DISABLED" && raw !== "ARCHIVED") {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Некорректный status (ожидается ACTIVE, DISABLED или ARCHIVED)",
        },
        { status: 400 },
      );
    }
    const status = raw as BusinessOperationalStatus;

    const existing = await prisma.business.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!existing) {
      return NextResponse.json(
        { ok: false, error: "Бизнес не найден" },
        { status: 404 },
      );
    }

    await updateBusinessVisibilityStatus(id, status);

    return NextResponse.json({
      ok: true,
      status,
    });
  } catch (error) {
    console.error("[admin/business/status] Error:", error);
    return NextResponse.json(
      { ok: false, error: "Внутренняя ошибка сервера" },
      { status: 500 },
    );
  }
}
