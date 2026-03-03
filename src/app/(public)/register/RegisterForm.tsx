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

export function RegisterForm({ from, buttonText = "Создать аккаунт", intent = "personal" }: { from?: string; buttonText?: string; intent?: string }) {
  const [state, formAction] = useActionState(registerAction, { ok: true });
  const isBusiness = from === "business";

  // Check if error is "email already exists"
  const isEmailExists = !state.ok && state.message?.includes("уже зарегистрирован");

  return (
    <form action={formAction} className="space-y-6">
      <input type="hidden" name="from" value={from || ""} />
      
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
          minLength={6}
          autoComplete="new-password"
          className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          placeholder="Минимум 6 символов"
        />
        {!state.ok && state.fieldErrors?.password && (
          <p className="mt-1 text-sm text-red-600">
            {state.fieldErrors.password[0]}
          </p>
        )}
      </div>

      {!state.ok && state.message && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <p className="text-sm text-red-800 mb-2">{state.message}</p>
          {isEmailExists && (
            <Link
              href={`/login?from=${from || ""}${isBusiness ? "&next=/business/onboarding" : ""}`}
              className="inline-block mt-2 text-sm font-medium text-blue-600 hover:text-blue-700"
            >
              Войдите, чтобы продолжить →
            </Link>
          )}
        </div>
      )}

      <div>
        <SubmitButton buttonText={buttonText} />
        {intent === "business" && (
          <p className="mt-4 text-xs text-muted-foreground text-center leading-relaxed">
            После регистрации потребуется подтверждение компании.
          </p>
        )}
      </div>
    </form>
  );
}
