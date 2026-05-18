import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import prisma from "@/lib/prisma";
import { Role } from "@prisma/client";

export const runtime = "nodejs";

/**
 * POST /api/admin/users/promote
 * Promote user to specified role (ADMIN, EDITOR, BUSINESS)
 * 
 * INTERNAL USE ONLY - Not exposed in UI
 * Only accessible by existing ADMIN users
 * 
 * Body: { email: string, role?: "ADMIN" | "EDITOR" | "BUSINESS" }
 * Default role: ADMIN
 */
export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json(
        { success: false, error: "Требуется авторизация" },
        { status: 401 }
      );
    }

    // Check admin role
    if (currentUser.role !== "ADMIN") {
      return NextResponse.json(
        { success: false, error: "Доступ запрещен. Требуется роль ADMIN" },
        { status: 403 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { email, role = "ADMIN" } = body;

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

    // Validate role - check against Role enum values
    const validRoles: Role[] = ["ADMIN", "MODERATOR", "BUSINESS_OWNER", "USER"];
    if (!validRoles.includes(role as Role)) {
      return NextResponse.json(
        {
          success: false,
          error: `Неверная роль. Допустимые значения: ${validRoles.join(", ")}`,
        },
        { status: 400 }
      );
    }

    // Find target user
    const targetUser = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        role: true,
      },
    });

    if (!targetUser) {
      return NextResponse.json(
        { success: false, error: `Пользователь с email "${email}" не найден` },
        { status: 404 }
      );
    }

    // Check if role is already set
    if (targetUser.role === role) {
      return NextResponse.json({
        success: true,
        targetUserId: targetUser.id,
        previousRole: targetUser.role,
        newRole: role,
        message: `Пользователь ${email} уже имеет роль ${role}`,
        noChangeNeeded: true,
      });
    }

    const previousRole = targetUser.role;

    // Update role + write audit log in a single transaction
    const [updatedUser] = await prisma.$transaction([
      prisma.user.update({
        where: { id: targetUser.id },
        data: { role: role as Role },
        select: {
          id: true,
          email: true,
          role: true,
        },
      }),
      prisma.auditLog.create({
        data: {
          actorId: currentUser.id,
          targetType: "USER",
          targetId: targetUser.id,
          action: "USER_ROLE_CHANGED",
          metadata: {
            oldRole: previousRole,
            newRole: role,
          },
        },
      }),
    ]);

    return NextResponse.json({
      success: true,
      targetUserId: updatedUser.id,
      previousRole,
      newRole: updatedUser.role,
      message: `Пользователь ${email} успешно изменен с ${previousRole} на ${role}`,
      note: "Изменения вступают в силу немедленно (повторный вход не требуется)",
    });
  } catch (error) {
    console.error("[admin/users/promote] Error:", error);

    return NextResponse.json(
      { success: false, error: "Внутренняя ошибка сервера" },
      { status: 500 }
    );
  }
}
