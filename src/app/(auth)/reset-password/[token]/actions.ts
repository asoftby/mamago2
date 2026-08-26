"use server";

import { redirect } from "next/navigation";
import { ZodError } from "zod";
import { resetPassword } from "@/server/auth/password-reset";
import { AuthError } from "@/server/auth/register";

export type ResetPasswordActionState =
  | { ok: true }
  | {
      ok: false;
      message: string;
      code?: "INVALID_TOKEN";
      fieldErrors?: Record<string, string[]>;
    };

export async function resetPasswordAction(
  token: string,
  _prevState: ResetPasswordActionState,
  formData: FormData,
): Promise<ResetPasswordActionState> {
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  if (password !== confirmPassword) {
    return {
      ok: false,
      message: "",
      fieldErrors: { confirmPassword: ["Пароли не совпадают"] },
    };
  }

  try {
    await resetPassword(token, password);
  } catch (error) {
    if (error instanceof ZodError) {
      return {
        ok: false,
        message: "",
        fieldErrors: error.flatten().fieldErrors as Record<string, string[]>,
      };
    }

    if (error instanceof AuthError && error.code === "INVALID_TOKEN") {
      return {
        ok: false,
        code: "INVALID_TOKEN",
        message: "Срок действия ссылки истёк или она уже была использована.",
      };
    }

    return {
      ok: false,
      message: "Не удалось изменить пароль. Попробуйте ещё раз.",
    };
  }

  redirect("/login?reset=success");
}
