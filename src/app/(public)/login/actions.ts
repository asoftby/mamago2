"use server";

import { redirect } from "next/navigation";
import { ZodError } from "zod";
import { loginUser } from "@/server/auth/login";
import { AuthError } from "@/server/auth/register";
import { setSessionCookie } from "@/lib/auth/session";

type ActionState =
  | { ok: true }
  | { ok: false; message: string; fieldErrors?: Record<string, string[]> };

export async function loginAction(
  prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const from = String(formData.get("from") ?? "");
  const next = String(formData.get("next") ?? "");

  try {
    const { sessionToken, user } = await loginUser(email, password);
    await setSessionCookie(sessionToken);

    // Success - redirect based on role and parameters
    if (next) {
      redirect(next);
    } else if (from === "business") {
      redirect("/business-entry");
    } else if (user.role === "USER") {
      redirect("/me/plan");
    } else {
      redirect("/minsk");
    }
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
      if (e.code === "INVALID_CREDENTIALS") {
        return {
          ok: false,
          message: "Неверный email или пароль",
        };
      }
    }

    // Generic error
    return {
      ok: false,
      message: "Не удалось войти. Попробуйте ещё раз.",
    };
  }
}
