"use server";

import { redirect } from "next/navigation";
import { ZodError } from "zod";
import { loginUser } from "@/server/auth/login";
import { AuthError } from "@/server/auth/register";
import { setSessionCookieAction } from "@/lib/auth/session";
import { getPostAuthRedirect } from "@/lib/auth/postAuthRedirect";

type ActionState =
  | { ok: true }
  | { ok: false; message: string; fieldErrors?: Record<string, string[]> };

export async function loginAction(
  prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");

  try {
    const { sessionToken, user } = await loginUser(email, password);
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
