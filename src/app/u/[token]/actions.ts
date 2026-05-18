"use server";

import prisma from "@/lib/prisma";
import { verifyUnsubscribeToken } from "@/lib/auth/unsubscribe-token";

export type UnsubscribeActionState =
  | { status: "confirm" }
  | { status: "success"; alreadyUnsubscribed: boolean }
  | { status: "error"; message: string };

export async function unsubscribeAction(
  token: string,
  prevState: UnsubscribeActionState,
  _formData: FormData
): Promise<UnsubscribeActionState> {
  try {
    // Verify token (marks as used - idempotent)
    const verified = await verifyUnsubscribeToken(token);

    if (!verified) {
      return {
        status: "error",
        message: "Ссылка недействительна или устарела.",
      };
    }

    // Find user
    const user = await prisma.user.findUnique({
      where: { id: verified.userId },
      select: { id: true, marketingEmailsEnabled: true },
    });

    if (!user) {
      return {
        status: "error",
        message: "Пользователь не найден.",
      };
    }

    // Check if already unsubscribed
    const alreadyUnsubscribed = !user.marketingEmailsEnabled;

    // Update user (idempotent - safe to call multiple times)
    if (user.marketingEmailsEnabled) {
      await prisma.user.update({
        where: { id: user.id },
        data: { marketingEmailsEnabled: false },
      });
    }

    return { status: "success", alreadyUnsubscribed };
  } catch (error) {
    console.error("[Unsubscribe] Error processing unsubscribe:", error);
    return {
      status: "error",
      message: "Произошла ошибка. Попробуйте ещё раз.",
    };
  }
}