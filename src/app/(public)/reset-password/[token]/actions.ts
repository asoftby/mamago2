"use server";

import { redirect } from "next/navigation";
import { ZodError } from "zod";
import { resetPassword } from "@/server/auth/password-reset";
import { AuthError } from "@/server/auth/register";

type ActionState =
  | { ok: true }
  | { ok: false; message: string; fieldErrors?: Record<string, string[]> };

export async function resetPasswordAction(
  token: string,
  prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  // Check if passwords match
  if (password !== confirmPassword) {
    return {
      ok: false,
      message: "Пароли не совпадают",
    };
  }

  try {
    await resetPassword(token, password);
  } catch (e) {
    // Handle Zod validation errors
    if (e instanceof ZodError) {
      return {
        ok: false,
        message: "Проверьте поля формы",
        fieldErrors: e.flatten().fieldErrors,
      };
    }

    // Handle AuthError
    if (e instanceof AuthError) {
      if (e.code === "INVALID_TOKEN") {
        return {
          ok: false,
          message: "Ссылка недействительна или истекла. Запросите новую ссылку.",
        };
      }
    }

    // Generic error
    return {
      ok: false,
      message: "Не удалось сбросить пароль. Попробуйте ещё раз.",
    };
  }

  // Success - redirect to login
  redirect("/login?reset=success");
}
