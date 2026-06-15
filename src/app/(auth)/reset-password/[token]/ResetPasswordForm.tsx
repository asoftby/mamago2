"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { resetPasswordAction } from "./actions";

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full h-12 rounded-xl bg-[#EF8759] hover:bg-primary-hover disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium transition-colors"
    >
      {pending ? "Сохранение..." : "Сохранить новый пароль"}
    </button>
  );
}

export function ResetPasswordForm({ token }: { token: string }) {
  const [state, formAction] = useActionState(
    resetPasswordAction.bind(null, token),
    { ok: true }
  );

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <label
          htmlFor="password"
          className="block text-sm font-medium text-neutral-700 mb-2"
        >
          Новый пароль
        </label>
        <input
          type="password"
          id="password"
          name="password"
          required
          minLength={6}
          autoComplete="new-password"
          className="w-full h-12 px-4 bg-white border border-neutral-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#EF8759] transition-shadow placeholder:text-neutral-400"
          placeholder="Минимум 6 символов"
        />
        {!state.ok && state.fieldErrors?.password && (
          <p className="mt-1 text-sm text-red-500">
            {state.fieldErrors.password[0]}
          </p>
        )}
      </div>

      <div>
        <label
          htmlFor="confirmPassword"
          className="block text-sm font-medium text-neutral-700 mb-2"
        >
          Подтвердите пароль
        </label>
        <input
          type="password"
          id="confirmPassword"
          name="confirmPassword"
          required
          minLength={6}
          autoComplete="new-password"
          className="w-full h-12 px-4 bg-white border border-neutral-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#EF8759] transition-shadow placeholder:text-neutral-400"
          placeholder="Повторите пароль"
        />
      </div>

      {!state.ok && state.message && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
          <p>{state.message}</p>
        </div>
      )}

      <SubmitButton />
    </form>
  );
}
