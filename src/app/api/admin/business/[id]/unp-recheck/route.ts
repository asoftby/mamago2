import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import prisma from "@/lib/prisma";
import { resolveBusinessUnpVerification } from "@/server/egr/resolveUnpVerification";

export const runtime = "nodejs";

/**
 * POST /api/admin/business/[id]/unp-recheck
 * Ручной триггер сверки УНП с ГРП из админки ("перепроверить сейчас").
 * Не меняет verificationStatus/operationalStatus бизнеса — только
 * unpVerificationStatus и связанные поля.
 */
export async function POST(
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
    if (user.role !== "ADMIN" && user.role !== "MODERATOR") {
      return NextResponse.json(
        { ok: false, error: "Доступ запрещён" },
        { status: 403 },
      );
    }

    const { id } = await params;
    const business = await prisma.business.findUnique({
      where: { id },
      select: { id: true, unp: true, legalName: true },
    });
    if (!business) {
      return NextResponse.json(
        { ok: false, error: "Бизнес не найден" },
        { status: 404 },
      );
    }
    if (!business.unp) {
      return NextResponse.json(
        { ok: false, error: "У бизнеса не указан УНП" },
        { status: 400 },
      );
    }

    const result = await resolveBusinessUnpVerification(
      business.unp,
      business.legalName ?? "",
    );

    const updated = await prisma.business.update({
      where: { id },
      data: {
        unpVerificationStatus: result.status,
        unpVerifiedAt: result.verifiedAt,
        unpOfficialName: result.officialName,
        unpLastCheckedAt: result.checkedAt,
      },
      select: {
        unpVerificationStatus: true,
        unpVerifiedAt: true,
        unpOfficialName: true,
        unpLastCheckedAt: true,
      },
    });

    return NextResponse.json({ ok: true, ...updated });
  } catch (error) {
    console.error("[admin/business/unp-recheck] Error:", error);
    return NextResponse.json(
      { ok: false, error: "Внутренняя ошибка сервера" },
      { status: 500 },
    );
  }
}
