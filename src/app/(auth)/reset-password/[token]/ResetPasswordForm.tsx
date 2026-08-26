"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import {
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
} from "@/lib/auth/passwordPolicy";
import {
  resetPasswordAction,
  type ResetPasswordActionState,
} from "./actions";

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="h-12 w-full rounded-xl bg-[#EF8759] font-medium text-white transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
    >
      {pending ? "Сохраняем..." : "Сохранить новый пароль"}
    </button>
  );
}

export function ResetPasswordForm({ token }: { token: string }) {
  const initialState: ResetPasswordActionState = { ok: true };
  const [state, formAction] = useActionState<ResetPasswordActionState, FormData>(
    resetPasswordAction.bind(null, token),
    initialState,
  );

  if (!state.ok && state.code === "INVALID_TOKEN") {
    return (
      <div className="space-y-5" aria-live="polite">
        <div className="space-y-1.5">
          <h1 className="text-xl font-semibold text-neutral-900">Ссылка больше не действует</h1>
          <p className="text-sm leading-6 text-neutral-500">{state.message}</p>
        </div>

        <Link
          href="/forgot-password"
          className="flex h-12 w-full items-center justify-center rounded-xl bg-[#EF8759] font-medium text-white transition-colors hover:bg-primary-hover"
        >
          Получить новую ссылку
        </Link>

        <div className="text-center">
          <Link
            href="/login"
            className="text-sm text-neutral-500 transition-colors hover:text-neutral-900"
          >
            Вернуться ко входу
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="space-y-1.5">
        <h1 className="text-xl font-semibold text-neutral-900">Новый пароль</h1>
        <p className="text-sm leading-6 text-neutral-500">
          Придумайте новый пароль — не менее {PASSWORD_MIN_LENGTH} символов.
        </p>
      </div>

      <form action={formAction} className="space-y-4" noValidate>
        <div>
          <label
            htmlFor="password"
            className="mb-2 block text-sm font-medium text-neutral-700"
          >
            Новый пароль
          </label>
          <input
            type="password"
            id="password"
            name="password"
            required
            minLength={PASSWORD_MIN_LENGTH}
            maxLength={PASSWORD_MAX_LENGTH}
            autoComplete="new-password"
            aria-invalid={!state.ok && Boolean(state.fieldErrors?.password)}
            aria-describedby={!state.ok && state.fieldErrors?.password ? "password-error" : undefined}
            className="h-12 w-full rounded-xl border border-neutral-200 bg-white px-4 text-sm transition-shadow placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-[#EF8759]"
            placeholder={`Не менее ${PASSWORD_MIN_LENGTH} символов`}
          />
          {!state.ok && state.fieldErrors?.password && (
            <p id="password-error" className="mt-1.5 text-sm text-red-500">
              {state.fieldErrors.password[0]}
            </p>
          )}
        </div>

        <div>
          <label
            htmlFor="confirmPassword"
            className="mb-2 block text-sm font-medium text-neutral-700"
          >
            Повторите пароль
          </label>
          <input
            type="password"
            id="confirmPassword"
            name="confirmPassword"
            required
            minLength={PASSWORD_MIN_LENGTH}
            maxLength={PASSWORD_MAX_LENGTH}
            autoComplete="new-password"
            aria-invalid={!state.ok && Boolean(state.fieldErrors?.confirmPassword)}
            aria-describedby={
              !state.ok && state.fieldErrors?.confirmPassword ? "confirm-password-error" : undefined
            }
            className="h-12 w-full rounded-xl border border-neutral-200 bg-white px-4 text-sm transition-shadow placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-[#EF8759]"
            placeholder="Повторите новый пароль"
          />
          {!state.ok && state.fieldErrors?.confirmPassword && (
            <p id="confirm-password-error" className="mt-1.5 text-sm text-red-500">
              {state.fieldErrors.confirmPassword[0]}
            </p>
          )}
        </div>

        {!state.ok && state.message && (
          <div
            className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
            role="alert"
          >
            {state.message}
          </div>
        )}

        <SubmitButton />
      </form>

      <div className="text-center">
        <Link
          href="/login"
          className="text-sm text-neutral-500 transition-colors hover:text-neutral-900"
        >
          Вернуться ко входу
        </Link>
      </div>
    </div>
  );
}
