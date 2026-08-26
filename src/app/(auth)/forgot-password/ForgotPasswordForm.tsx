"use client";

import Link from "next/link";
import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { PASSWORD_RESET_RESEND_COOLDOWN_SECONDS } from "@/lib/auth/passwordResetPolicy";
import {
  forgotPasswordAction,
  type ForgotPasswordActionState,
} from "./actions";

function PrimarySubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="h-12 w-full rounded-xl bg-[#EF8759] font-medium text-white transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
    >
      {pending ? "Отправляем..." : "Отправить инструкции"}
    </button>
  );
}

function getCooldownRemaining(sentAt: number): number {
  const endsAt = sentAt + PASSWORD_RESET_RESEND_COOLDOWN_SECONDS * 1000;
  return Math.max(0, Math.ceil((endsAt - Date.now()) / 1000));
}

function ResendButton({ sentAt }: { sentAt: number }) {
  const { pending } = useFormStatus();
  const [remaining, setRemaining] = useState(() => getCooldownRemaining(sentAt));

  useEffect(() => {
    setRemaining(getCooldownRemaining(sentAt));

    const interval = window.setInterval(() => {
      setRemaining(getCooldownRemaining(sentAt));
    }, 1000);

    return () => window.clearInterval(interval);
  }, [sentAt]);

  const disabled = pending || remaining > 0;

  return (
    <button
      type="submit"
      disabled={disabled}
      className="font-medium text-[#D96F43] transition-colors hover:text-primary-hover disabled:cursor-not-allowed disabled:text-neutral-400"
    >
      {pending
        ? "Отправляем..."
        : remaining > 0
          ? `Отправить ещё раз через ${remaining} с`
          : "Отправить ещё раз"}
    </button>
  );
}

export function ForgotPasswordForm() {
  const initialState: ForgotPasswordActionState = { ok: true, status: "idle" };
  const [state, formAction] = useActionState<ForgotPasswordActionState, FormData>(
    forgotPasswordAction,
    initialState,
  );

  if (state.ok && state.status === "sent") {
    return (
      <div className="space-y-5" aria-live="polite">
        <div className="space-y-1.5">
          <h1 className="text-xl font-semibold text-neutral-900">Проверьте почту</h1>
          <p className="text-sm leading-6 text-neutral-500">
            Если аккаунт <span className="font-medium text-neutral-700">{state.email}</span> существует,
            мы отправили на него ссылку для восстановления пароля.
          </p>
        </div>

        <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm leading-5 text-green-800">
          Ссылка действует 1 час. Если письма нет во входящих, проверьте папку «Спам».
        </div>

        <Link
          href="/login"
          className="flex h-12 w-full items-center justify-center rounded-xl bg-[#EF8759] font-medium text-white transition-colors hover:bg-primary-hover"
        >
          Вернуться ко входу
        </Link>

        <form action={formAction} className="text-center text-sm text-neutral-500">
          <input type="hidden" name="email" value={state.email} />
          <span>Не пришло письмо? </span>
          <ResendButton sentAt={state.sentAt} />
        </form>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="space-y-1.5">
        <h1 className="text-xl font-semibold text-neutral-900">Восстановление пароля</h1>
        <p className="text-sm leading-6 text-neutral-500">
          Введите email, и мы пришлём ссылку для восстановления пароля.
        </p>
      </div>

      <form action={formAction} className="space-y-4" noValidate>
        <div>
          <label htmlFor="email" className="sr-only">
            Email
          </label>
          <input
            type="email"
            id="email"
            name="email"
            required
            autoComplete="email"
            inputMode="email"
            placeholder="Email"
            aria-invalid={!state.ok && Boolean(state.fieldErrors?.email)}
            aria-describedby={!state.ok && state.fieldErrors?.email ? "forgot-email-error" : undefined}
            className="h-12 w-full rounded-xl border border-neutral-200 bg-white px-4 text-sm transition-shadow placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-[#EF8759]"
          />
          {!state.ok && state.fieldErrors?.email && (
            <p id="forgot-email-error" className="mt-1.5 text-sm text-red-500">
              {state.fieldErrors.email[0]}
            </p>
          )}
        </div>

        {!state.ok && state.message && (
          <p className="text-sm text-red-500" role="alert">
            {state.message}
          </p>
        )}

        <PrimarySubmitButton />
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
