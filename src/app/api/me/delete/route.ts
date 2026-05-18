import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import { deleteSessionCookieAction } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

export async function POST() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // ── Balance guard: запретить удаление, если пользователь — владелец бизнеса с положительным балансом ──
    const business = await prisma.business.findFirst({
      where: { ownerUserId: user.id },
      select: {
        id: true,
        billingAccount: {
          select: {
            depositBalance: true,
            status: true,
          },
        },
      },
    });

    if (business?.billingAccount) {
      const balance = Number(business.billingAccount.depositBalance);
      if (balance > 0) {
        return NextResponse.json(
          {
            error:
              "Нельзя удалить аккаунт с активным балансом бизнеса. Обратитесь в поддержку.",
          },
          { status: 409 },
        );
      }
    }

    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: user.id },
        data: { deletedAt: new Date() },
      });

      await tx.session.deleteMany({
        where: { userId: user.id },
      });
    });

    await deleteSessionCookieAction();
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[api/me/delete]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
