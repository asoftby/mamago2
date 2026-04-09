import type { User } from "@prisma/client";
import { NextResponse } from "next/server";

export function isEmailVerified(user: User | { emailVerifiedAt: Date | null }): boolean {
  return user.emailVerifiedAt != null;
}

export function jsonEmailNotVerified() {
  return NextResponse.json(
    {
      error: "Подтвердите email, чтобы продолжить",
      code: "EMAIL_NOT_VERIFIED" as const,
    },
    { status: 403 },
  );
}
