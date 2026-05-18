import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import { needsInfo } from "@/server/services/businessVerification.service";

export const runtime = "nodejs";

/**
 * POST /api/admin/business-verification/[id]/needs-info
 * Request more information from business owner
 */
export async function POST(
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
    const body = await request.json();
    const { note } = body;

    if (!note || note.trim().length === 0) {
      return NextResponse.json(
        { ok: false, error: "Комментарий обязателен" },
        { status: 400 }
      );
    }

    // Request more info
    await needsInfo(id, user.id, note);

    return NextResponse.json({
      ok: true,
      message: "Запрошено уточнение данных",
    });
  } catch (error) {
    console.error("[admin/business-verification/needs-info] Error:", error);

    return NextResponse.json(
      { ok: false, error: "Внутренняя ошибка сервера" },
      { status: 400 }
    );
  }
}
