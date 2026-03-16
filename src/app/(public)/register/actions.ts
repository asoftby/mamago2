"use server";

import { redirect } from "next/navigation";
import { ZodError } from "zod";
import { registerUser, AuthError } from "@/server/auth/register";
import { setSessionCookieAction } from "@/lib/auth/session";
import { getPostAuthRedirect } from "@/lib/auth/postAuthRedirect";

type ActionState =
  | { ok: true }
  | { ok: false; message: string; fieldErrors?: Record<string, string[]> };

export async function registerAction(
  prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");

  try {
    const { sessionToken, user } = await registerUser(email, password);
    await setSessionCookieAction(sessionToken);

    // Success - redirect to unified post-auth destination
    redirect(getPostAuthRedirect());
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
