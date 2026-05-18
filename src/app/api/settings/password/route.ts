import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/server";
import prisma from "@/lib/prisma";
import { hashPassword, verifyPassword } from "@/lib/auth/crypto";
import { passwordSchema } from "@/lib/auth/passwordPolicy";

const bodySchema = z.object({
  currentPassword: z.string().min(1, "Введите текущий пароль"),
  newPassword: passwordSchema.regex(/\d/u, "Пароль должен содержать хотя бы одну цифру"),
});

export async function PATCH(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { id: true, passwordHash: true },
  });

  if (!dbUser?.passwordHash) {
    return NextResponse.json(
      { error: "Password is not set for this account" },
      { status: 400 },
    );
  }

  const isValidCurrentPassword = await verifyPassword(
    parsed.data.currentPassword,
    dbUser.passwordHash,
  );

  if (!isValidCurrentPassword) {
    return NextResponse.json(
      { error: "Wrong current password" },
      { status: 401 },
    );
  }

  const passwordHash = await hashPassword(parsed.data.newPassword);

  await prisma.user.update({
    where: { id: dbUser.id },
    data: { passwordHash },
  });

  return NextResponse.json({ ok: true });
}
