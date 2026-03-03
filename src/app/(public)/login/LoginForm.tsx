"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { loginAction } from "./actions";
import { PrimaryButton } from "@/components/ui/PrimaryButton";

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <PrimaryButton
      type="submit"
      disabled={pending}
      className="w-full"
    >
      {pending ? "Вход..." : "Войти"}
    </PrimaryButton>
  );
}

export function LoginForm({ from, next }: { from?: string; next?: string }) {
  const [state, formAction] = useActionState(loginAction, { ok: true });

  return (
    <form action={formAction} className="space-y-6">
      <input type="hidden" name="from" value={from || ""} />
      <input type="hidden" name="next" value={next || ""} />
      
      <div>
        <label
          htmlFor="email"
          className="block text-sm font-medium text-gray-700 mb-2"
        >
          Email
        </label>
        <input
          type="email"
          id="email"
          name="email"
          required
          autoComplete="email"
          className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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
          className="block text-sm font-medium text-gray-700 mb-2"
        >
          Пароль
        </label>
        <input
          type="password"
          id="password"
          name="password"
          required
          autoComplete="current-password"
          className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          placeholder="Введите пароль"
        />
        {!state.ok && state.fieldErrors?.password && (
          <p className="mt-1 text-sm text-red-600">
            {state.fieldErrors.password[0]}
          </p>
        )}
      </div>

      {!state.ok && state.message && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <p className="text-sm text-red-800">{state.message}</p>
        </div>
      )}

      <SubmitButton />
    </form>
  );
}
