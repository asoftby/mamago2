"use server";

import { ZodError } from "zod";
import { requestPasswordReset } from "@/server/auth/password-reset";

type ActionState =
  | { ok: true; message?: string }
  | { ok: false; message: string; fieldErrors?: Record<string, string[]> };

export async function forgotPasswordAction(
  prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const email = String(formData.get("email") ?? "").trim();

  if (!email) {
    return { ok: false, message: "", fieldErrors: { email: ["Укажите email"] } };
  }

  try {
    await requestPasswordReset(email);
  } catch (e) {
    if (e instanceof ZodError) {
      return {
        ok: false,
        message: "Проверьте поля формы",
        fieldErrors: e.flatten().fieldErrors as Record<string, string[]>,
      };
    }
    // Don't leak unexpected errors — silently succeed for security
  }

  // Always return success message (don't reveal if email exists)
  return {
    ok: true,
    message: "Если аккаунт с таким email существует, мы отправили инструкции.",
  };
}
