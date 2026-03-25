"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { forgotPasswordAction } from "./actions";


type ActionState =
  | { ok: true; message?: string }
  | { ok: false; message: string; fieldErrors?: Record<string, string[]> };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full h-12 rounded-xl bg-[#EF8759] hover:bg-[#e07040] disabled:opacity-50 text-white font-medium transition-colors"
    >
      {pending ? "Отправляем..." : "Отправить инструкции"}
    </button>
  );
}

export function ForgotPasswordForm() {
  const [state, formAction] = useActionState<ActionState, FormData>(forgotPasswordAction, { ok: true });

  return (
    <form action={formAction} className="space-y-4">
      <input
        type="email"
        id="email"
        name="email"
        required
        autoComplete="email"
        placeholder="Email"
        className="w-full h-12 px-4 bg-white border border-neutral-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#EF8759] transition-shadow placeholder:text-neutral-400"
      />
      {!state.ok && state.fieldErrors?.email && (
        <p className="text-sm text-red-500">{state.fieldErrors.email[0]}</p>
      )}

      {state.ok && state.message && (
        <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 text-sm text-green-800">
          {state.message}
        </div>
      )}
      {!state.ok && state.message && (
        <p className="text-sm text-red-500">{state.message}</p>
      )}

      <SubmitButton />
    </form>
  );
}
