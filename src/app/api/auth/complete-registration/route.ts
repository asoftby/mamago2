import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth/crypto";
import { getCurrentUser } from "@/lib/auth/server";

const bodySchema = z.object({
  email: z.string().email("Некорректный email"),
  password: z.string().min(8, "Пароль — минимум 8 символов"),
});

const STUB_EMAIL_SUFFIX = "@pending.mamago.by";

/**
 * Завершение регистрации после подтверждения телефона (stub-сессия из verify-otp REGISTER).
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Требуется вход" }, { status: 401 });
    }

    if (!user.phoneVerifiedAt) {
      return NextResponse.json(
        { error: "Сначала подтвердите номер телефона" },
        { status: 400 },
      );
    }

    if (!user.email.endsWith(STUB_EMAIL_SUFFIX)) {
      return NextResponse.json(
        { error: "Регистрация уже завершена" },
        { status: 400 },
      );
    }

    const json = await request.json();
    const { email, password } = bodySchema.parse(json);
    const normalizedEmail = email.toLowerCase().trim();

    const other = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });
    if (other && other.id !== user.id) {
      return NextResponse.json({ error: "Этот email уже занят" }, { status: 409 });
    }

    const passwordHash = await hashPassword(password);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        email: normalizedEmail,
        passwordHash,
        status: "ACTIVE",
      },
    });

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: normalizedEmail,
        role: user.role,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      const first = error.issues[0];
      return NextResponse.json(
        { error: first?.message ?? "Некорректные данные" },
        { status: 400 },
      );
    }
    console.error("[auth/complete-registration]", error);
    return NextResponse.json({ error: "Внутренняя ошибка" }, { status: 500 });
  }
}
