"use server";

import { redirect } from "next/navigation";
import { ZodError } from "zod";
import { registerUser, AuthError } from "@/server/auth/register";
import { setSessionCookie } from "@/lib/auth/session";

type ActionState =
  | { ok: true }
  | { ok: false; message: string; fieldErrors?: Record<string, string[]> };

export async function registerAction(
  prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const from = String(formData.get("from") ?? "");

  try {
    const { sessionToken, user } = await registerUser(email, password);
    await setSessionCookie(sessionToken);

    // Success - redirect based on from parameter and role
    if (from === "business") {
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
      if (e.code === "EMAIL_ALREADY_EXISTS") {
        return {
          ok: false,
          message: "Этот email уже зарегистрирован.",
        };
      }
    }

    // Generic error
    return {
      ok: false,
      message: "Не удалось создать аккаунт. Попробуйте ещё раз.",
    };
  }
}
