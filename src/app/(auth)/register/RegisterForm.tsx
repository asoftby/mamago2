"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { registerAction } from "./actions";
import Link from "next/link";
import { PrimaryButton } from "@/components/ui/PrimaryButton";

function SubmitButton({ buttonText }: { buttonText: string }) {
  const { pending } = useFormStatus();

  return (
    <PrimaryButton
      type="submit"
      disabled={pending}
      className="w-full"
    >
      {pending ? "Создание аккаунта..." : buttonText}
    </PrimaryButton>
  );
}

export function RegisterForm({ buttonText = "Создать аккаунт" }: { buttonText?: string }) {
  const [state, formAction] = useActionState(registerAction, { ok: true });

  const isEmailExists = !state.ok && state.message?.includes("уже зарегистрирован");

  return (
    <form action={formAction} className="space-y-6">

      <div>
        <label
          htmlFor="email"
          className="mb-2 block text-sm font-medium text-gray-700"
        >
          Email
        </label>
        <input
          type="email"
          id="email"
          name="email"
          required
          autoComplete="email"
          className="w-full rounded-md border border-gray-300 px-4 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
          placeholder="your@email.com"
        />
        {!state.ok && state.fieldErrors?.email && (
          <p className="mt-1 text-sm text-red-600">
            {state.fieldErrors.email[0]}
          </p>
        )}
      </div>

      <div>
        <label
          htmlFor="password"
          className="mb-2 block text-sm font-medium text-gray-700"
        >
          Пароль
        </label>
        <input
          type="password"
          id="password"
          name="password"
          required
          minLength={6}
          autoComplete="new-password"
          className="w-full rounded-md border border-gray-300 px-4 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
          placeholder="Минимум 6 символов"
        />
        {!state.ok && state.fieldErrors?.password && (
          <p className="mt-1 text-sm text-red-600">
            {state.fieldErrors.password[0]}
          </p>
        )}
      </div>

      {!state.ok && state.message && (
        <div className="rounded-md border border-red-200 bg-red-50 p-4">
          <p className="mb-2 text-sm text-red-800">{state.message}</p>
          {isEmailExists && (
            <Link
              href="/login"
              className="mt-2 inline-block text-sm font-medium text-blue-600 hover:text-blue-700"
            >
              Войдите, чтобы продолжить →
            </Link>
          )}
        </div>
      )}

      <div>
        <SubmitButton buttonText={buttonText} />
      </div>
    </form>
  );
}
