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
  const email = String(formData.get("email") ?? "");

  try {
    await requestPasswordReset(email);

    // Always show success message (don't reveal if email exists)
    return {
      ok: true,
      message:
        "Если этот email зарегистрирован, вы получите письмо с инструкциями для сброса пароля.",
    };
  } catch (e) {
    // Handle Zod validation errors
    if (e instanceof ZodError) {
      return {
        ok: false,
        message: "Проверьте поля формы",
        fieldErrors: e.flatten().fieldErrors,
      };
    }

    // Generic error
    return {
      ok: false,
      message: "Не удалось отправить запрос. Попробуйте ещё раз.",
    };
  }
}
