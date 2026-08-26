"use server";

import { ZodError } from "zod";
import { requestPasswordReset } from "@/server/auth/password-reset";

export type ForgotPasswordActionState =
  | { ok: true; status: "idle" }
  | { ok: true; status: "sent"; email: string; sentAt: number }
  | {
      ok: false;
      status: "error";
      message: string;
      fieldErrors?: Record<string, string[]>;
    };

export async function forgotPasswordAction(
  _prevState: ForgotPasswordActionState,
  formData: FormData,
): Promise<ForgotPasswordActionState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();

  if (!email) {
    return {
      ok: false,
      status: "error",
      message: "",
      fieldErrors: { email: ["Укажите email"] },
    };
  }

  try {
    await requestPasswordReset(email);
  } catch (error) {
    if (error instanceof ZodError) {
      return {
        ok: false,
        status: "error",
        message: "",
        fieldErrors: error.flatten().fieldErrors as Record<string, string[]>,
      };
    }

    // Keep the public response neutral: unexpected infrastructure errors must
    // not reveal whether this email belongs to an account.
    console.error("[Password Reset] request failed", error);
  }

  return {
    ok: true,
    status: "sent",
    email,
    sentAt: Date.now(),
  };
}
