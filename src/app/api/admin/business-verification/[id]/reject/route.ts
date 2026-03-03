import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import { reject } from "@/server/services/businessVerification.service";

export const runtime = "nodejs";

/**
 * POST /api/admin/business-verification/[id]/reject
 * Reject business verification
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

    if (!note || typeof note !== "string" || note.trim().length === 0) {
      return NextResponse.json(
        { ok: false, error: "Причина отклонения обязательна" },
        { status: 400 }
      );
    }

    // Reject business
    await reject(id, user.id, note);

    return NextResponse.json({
      ok: true,
      message: "Бизнес отклонен",
    });
  } catch (error) {
    console.error("[admin/business-verification/reject] Error:", error);

    const errorMessage =
      error instanceof Error ? error.message : "Внутренняя ошибка сервера";

    return NextResponse.json(
      { ok: false, error: errorMessage },
      { status: 400 }
    );
  }
}
