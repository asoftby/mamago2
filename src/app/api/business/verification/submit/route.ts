import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import { isEmailVerified, jsonEmailNotVerified } from "@/lib/auth/requireVerifiedEmail";
import { submitForVerification } from "@/server/services/businessVerification.service";
import prisma from "@/lib/prisma";

export const runtime = "nodejs";

/**
 * POST /api/business/verification/submit
 * Submit business for verification
 */
export async function POST() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { ok: false, error: "Требуется авторизация" },
        { status: 401 }
      );
    }

    if (!isEmailVerified(user)) {
      return jsonEmailNotVerified();
    }

    // Find business for current user
    const business = await prisma.business.findUnique({
      where: { ownerUserId: user.id },
      select: { id: true },
    });

    if (!business) {
      return NextResponse.json(
        { ok: false, error: "Бизнес не найден" },
        { status: 404 }
      );
    }

    // Submit for verification
    await submitForVerification(business.id, user.id);

    return NextResponse.json({
      ok: true,
      message: "Заявка отправлена на проверку",
    });
  } catch (error) {
    console.error("[verification/submit] Error:", error);

    const errorMessage =
      error instanceof Error ? error.message : "Внутренняя ошибка сервера";

    return NextResponse.json(
      { ok: false, error: errorMessage },
      { status: 400 }
    );
  }
}
