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
    // Чтение и запись — одной транзакцией с блокировкой строки: параллельные патчи разных
    // ключей не затирают друг друга (иначе побеждает последняя запись всего JSON).
    const updated = await prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<Array<{ features: unknown }>>`
        SELECT "features" FROM "Business" WHERE "id" = ${id} FOR UPDATE
      `;
      if (rows.length === 0) return null;
      return tx.business.update({
        where: { id },
        data: { features: mergeBusinessFeatures(rows[0]!.features, patch) },
        select: { features: true },
      });
    });
    if (!updated) {
      return NextResponse.json({ ok: false, error: "Бизнес не найден" }, { status: 404 });
    }

    return NextResponse.json({ ok: true, features: parseBusinessFeatures(updated.features) });
  } catch (error) {
    console.error("[admin/business/features] Error:", error);
    return NextResponse.json({ ok: false, error: "Внутренняя ошибка сервера" }, { status: 500 });
  }
}
