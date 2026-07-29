"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { PASSWORD_MIN_LENGTH, validatePasswordPolicy } from "@/lib/auth/passwordPolicy";
import { notifyAuthStateChanged } from "@/lib/auth/client";

type TokenStatus = "VALID" | "EXPIRED" | "USED" | "INVALID" | "ALREADY_ACTIVE";

type Phase =
  | { step: "loading" }
  | { step: "blocked"; status: Exclude<TokenStatus, "VALID"> }
  | { step: "form" }
  | { step: "submitting" }
  | { step: "success" };

const INPUT_CLASS =
  "w-full h-12 px-4 bg-white border border-neutral-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#EF8759] transition-shadow placeholder:text-neutral-400";
const BUTTON_CLASS =
  "w-full h-12 rounded-xl bg-[#EF8759] hover:bg-primary-hover disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium transition-colors";

const BLOCKED_COPY: Record<Exclude<TokenStatus, "VALID">, { title: string; body: string }> = {
  EXPIRED: {
    title: "Ссылка устарела",
    body: "Срок действия ссылки истёк. Запросите новую на странице входа — введите свой email и пароль как обычно.",
  },
  USED: {
    title: "Ссылка уже использована",
    body: "Эта ссылка активации уже была использована. Если аккаунт ещё не активен, запросите новую ссылку на странице входа.",
  },
  INVALID: {
    title: "Некорректная ссылка",
    body: "Эта ссылка активации недействительна. Проверьте, что скопировали её полностью, или запросите новую на странице входа.",
  },
  ALREADY_ACTIVE: {
    title: "Аккаунт уже активирован",
    body: "Этот аккаунт уже активирован. Просто войдите с вашим email и паролем.",
  },
};

export function ActivateForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  // Read once into local state — never re-derived from the URL after mount,
  // so it can't end up in a query-string history entry we re-read later,
  // and it's never passed to console.* anywhere in this component.
  const [token] = useState(() => searchParams.get("token") ?? "");

  const [phase, setPhase] = useState<Phase>(() =>
    token ? { step: "loading" } : { step: "blocked", status: "INVALID" },
  );
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [formError, setFormError] = useState("");

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/auth/activation/status", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({ token }),
        });
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        const status: TokenStatus = data.status === "VALID" ? "VALID" : (data.status ?? "INVALID");
        setPhase(status === "VALID" ? { step: "form" } : { step: "blocked", status });
      } catch {
        if (!cancelled) setPhase({ step: "blocked", status: "INVALID" });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFormError("");
    const validation = validatePasswordPolicy(password);
    if (!validation.valid) {
      setFormError(validation.error);
      return;
    }
    if (password !== confirmPassword) {
      setFormError("Пароли не совпадают");
      return;
    }
    setPhase({ step: "submitting" });
    try {
      const res = await fetch("/api/auth/activation/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ token, newPassword: password }),
      });
      if (!res.ok) {
        // The complete endpoint is deliberately generic on failure (no
        // token-guessing oracle on the consuming action) — re-check status
        // so the user sees *why* (expired/used/invalid) rather than a bare error.
        const recheck = await fetch("/api/auth/activation/status", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({ token }),
        });
        const data = await recheck.json().catch(() => ({}));
        const status: TokenStatus = data.status === "VALID" ? "INVALID" : (data.status ?? "INVALID");
        setPhase({ step: "blocked", status: status === "VALID" ? "INVALID" : status });
        return;
      }
      setPhase({ step: "success" });
      notifyAuthStateChanged();
    } catch {
      setFormError("Ошибка сети. Попробуйте ещё раз.");
      setPhase({ step: "form" });
    }
  }

  if (phase.step === "loading") {
    return (
      <div className="py-8 text-center text-sm text-neutral-500">Проверяем ссылку...</div>
    );
  }

  if (phase.step === "blocked") {
    const copy = BLOCKED_COPY[phase.status];
    return (
      <div className="space-y-4">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold text-neutral-900">{copy.title}</h1>
          <p className="text-sm text-neutral-500">{copy.body}</p>
        </div>
        <Link href="/login" className={`${BUTTON_CLASS} flex items-center justify-center`}>
          Перейти ко входу
        </Link>
      </div>
    );
  }

  if (phase.step === "success") {
    return (
      <div className="space-y-4">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold text-neutral-900">Аккаунт активирован</h1>
          <p className="text-sm text-neutral-500">Пароль сохранён. Теперь можно войти.</p>
        </div>
        <button type="button" onClick={() => router.replace("/login")} className={BUTTON_CLASS}>
          Войти
        </button>
      </div>
    );
  }

  const submitting = phase.step === "submitting";

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold text-neutral-900">Активация аккаунта</h1>
        <p className="text-sm text-neutral-500">Задайте пароль, чтобы завершить активацию.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="activate-password" className="block text-sm font-medium text-neutral-700 mb-2">
            Новый пароль
          </label>
          <input
            id="activate-password"
            type={showPassword ? "text" : "password"}
            required
            minLength={PASSWORD_MIN_LENGTH}
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={INPUT_CLASS}
            placeholder={`Минимум ${PASSWORD_MIN_LENGTH} символов`}
          />
        </div>

        <div>
          <label htmlFor="activate-confirm-password" className="block text-sm font-medium text-neutral-700 mb-2">
            Подтвердите пароль
          </label>
          <input
            id="activate-confirm-password"
            type={showPassword ? "text" : "password"}
            required
            minLength={PASSWORD_MIN_LENGTH}
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className={INPUT_CLASS}
            placeholder="Повторите пароль"
          />
          <label className="mt-2 flex items-center gap-2 text-xs text-neutral-500">
            <input
              type="checkbox"
              checked={showPassword}
              onChange={(e) => setShowPassword(e.target.checked)}
            />
            Показать пароль
          </label>
        </div>

        {formError && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
            <p>{formError}</p>
          </div>
        )}

        <button type="submit" disabled={submitting} className={BUTTON_CLASS}>
          {submitting ? "Сохранение..." : "Активировать аккаунт"}
        </button>
      </form>

      <p className="text-xs text-neutral-400 text-center leading-relaxed px-2">
        Продолжая, вы соглашаетесь с{" "}
        <Link href="/terms" className="text-neutral-600 hover:text-neutral-900 underline underline-offset-2">
          условиями использования
        </Link>{" "}
        и{" "}
        <Link href="/privacy" className="text-neutral-600 hover:text-neutral-900 underline underline-offset-2">
          политикой конфиденциальности
        </Link>
      </p>
    </div>
  );
}
