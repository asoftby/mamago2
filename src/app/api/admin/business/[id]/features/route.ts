import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import prisma from "@/lib/prisma";
import { mergeBusinessFeatures, parseBusinessFeatures, parseBusinessFeaturesPatch } from "@/lib/business/businessFeatures";

export const runtime = "nodejs";

/**
 * PATCH /api/admin/business/[id]/features
 * Body: { newOfferWizard?: boolean, leadForm?: boolean, selections?: boolean }
 * Меняет только перечисленные ключи `Business.features`.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ ok: false, error: "Требуется авторизация" }, { status: 401 });
    }
    if (user.role !== "ADMIN") {
      return NextResponse.json({ ok: false, error: "Доступ запрещён" }, { status: 403 });
    }

    const patch = parseBusinessFeaturesPatch(await request.json().catch(() => null));
    if (!patch) {
      return NextResponse.json(
        { ok: false, error: "Некорректное тело запроса (ожидаются boolean-значения известных ключей)" },
        { status: 400 },
      );
    }

    const { id } = await params;
    const existing = await prisma.business.findUnique({ where: { id }, select: { features: true } });
    if (!existing) {
      return NextResponse.json({ ok: false, error: "Бизнес не найден" }, { status: 404 });
    }

    const updated = await prisma.business.update({
      where: { id },
      data: { features: mergeBusinessFeatures(existing.features, patch) },
      select: { features: true },
    });

    return NextResponse.json({ ok: true, features: parseBusinessFeatures(updated.features) });
  } catch (error) {
    console.error("[admin/business/features] Error:", error);
    return NextResponse.json({ ok: false, error: "Внутренняя ошибка сервера" }, { status: 500 });
  }
}
