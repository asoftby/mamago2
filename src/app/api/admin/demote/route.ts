import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import { demoteFromAdminByEmail } from "@/server/services/userRole.service";

export const runtime = "nodejs";

/**
 * POST /api/admin/demote
 * Demote user from ADMIN to USER role
 * 
 * INTERNAL USE ONLY - Not exposed in UI
 * Only accessible by existing ADMIN users
 * Cannot demote yourself
 */
export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { success: false, error: "Требуется авторизация" },
        { status: 401 }
      );
    }

    // Check admin role
    if (user.role !== "ADMIN") {
      return NextResponse.json(
        { success: false, error: "Доступ запрещен. Требуется роль ADMIN" },
        { status: 403 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { email } = body;

    // Validate email
    if (!email || typeof email !== "string") {
      return NextResponse.json(
        { success: false, error: "Email обязателен" },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { success: false, error: "Неверный формат email" },
        { status: 400 }
      );
    }

    // Demote user
    const result = await demoteFromAdminByEmail(email, user.id);

    return NextResponse.json({
      success: true,
      user: {
        id: result.id,
        email: result.email,
        role: result.role,
      },
      message: result.wasNotAdmin
        ? `Пользователь ${email} не является ADMIN`
        : `Пользователь ${email} успешно понижен до USER`,
    });
  } catch (error) {
    console.error("[admin/demote] Error:", error);

    const errorMessage =
      error instanceof Error ? error.message : "Внутренняя ошибка сервера";

    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 400 }
    );
  }
}
